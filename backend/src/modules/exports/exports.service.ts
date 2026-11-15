import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { errorBody } from 'src/common/utils';
import { ColumnType, ExportDto, ExportSheetDto } from './dto/export.dto';

type Cell = string | number | null;
type Sheet = Omit<ExportSheetDto, 'rows'> & { rows: Cell[][] };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MAX_TEXT = 2000;

/** Excel would run a cell starting like this as a formula; a leading apostrophe keeps it text (CSV only — xlsx stores strings as strings). */
const FORMULA_START = /^[=+\-@\t\r]/;

const MIME = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv; charset=utf-8',
};

/** F11: writes tables as .xlsx (exceljs) or CSV (UTF-8 with BOM, so Excel shows Armenian). */
@Injectable()
export class ExportsService {
    async render(dto: ExportDto): Promise<{ data: Uint8Array; mimeType: string; filename: string }> {
        const sheets: Sheet[] = dto.sheets.map((s) => ({ name: s.name, columns: s.columns, rows: this.cells(s) }));
        const base = dto.filename.replace(/[^\p{L}\p{N}._ -]/gu, '').trim().slice(0, 80) || 'export';
        if (dto.format === 'csv') {
            return { data: new TextEncoder().encode(this.csv(sheets)), mimeType: MIME.csv, filename: `${base}.csv` };
        }
        return { data: await this.xlsx(sheets, dto.moneyDecimals ?? 0), mimeType: MIME.xlsx, filename: `${base}.xlsx` };
    }

    /** Every row as wide as the header, every cell a string, a number or empty. */
    private cells(sheet: ExportSheetDto): Cell[][] {
        return sheet.rows.map((row, r) => {
            if (!Array.isArray(row) || row.length > sheet.columns.length) {
                throw new BadRequestException(errorBody('exportBadRow', `Row ${r + 1} of "${sheet.name}" does not match its columns`));
            }
            return sheet.columns.map((_, c) => {
                const v = row[c];
                if (v === null || v === undefined || v === '') return null;
                if (typeof v === 'number') return Number.isFinite(v) ? v : null;
                if (typeof v === 'string') return v.slice(0, MAX_TEXT);
                if (typeof v === 'boolean') return v ? 1 : 0;
                throw new BadRequestException(errorBody('exportBadRow', `Row ${r + 1} of "${sheet.name}" has a value that is not text or a number`));
            });
        });
    }

    private csv(sheets: Sheet[]): string {
        const out: string[] = [];
        sheets.forEach((sheet, i) => {
            if (sheets.length > 1) {
                if (i > 0) out.push('');
                out.push(this.csvLine([sheet.name]));
            }
            out.push(this.csvLine(sheet.columns.map((c) => c.header)));
            for (const row of sheet.rows) out.push(this.csvLine(row.map((v, c) => this.csvValue(v, sheet.columns[c].type))));
        });
        return `﻿${out.join('\r\n')}\r\n`;
    }

    private csvValue(v: Cell, type: ColumnType): string {
        if (v === null) return '';
        if (typeof v === 'number') return String(v);
        if (type === 'datetime' && DAY_TIME.test(v)) return v.slice(0, 16).replace('T', ' ');
        return FORMULA_START.test(v) ? `'${v}` : v;
    }

    private csvLine(values: (string | null)[]): string {
        return values.map((v) => (v === null ? '' : /[",\r\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',');
    }

    private async xlsx(sheets: Sheet[], moneyDecimals: number): Promise<Uint8Array> {
        const wb = new Workbook();
        wb.creator = 'DentFlow';
        wb.created = new Date();
        const used = new Set<string>();
        const money = moneyDecimals > 0 ? `#,##0.${'0'.repeat(moneyDecimals)}` : '#,##0';
        const formats: Record<ColumnType, string | undefined> = {
            text: undefined,
            number: '#,##0.##',
            money,
            percent: '0.##"%"',
            date: 'dd.mm.yyyy',
            datetime: 'dd.mm.yyyy hh:mm',
        };

        for (const sheet of sheets) {
            // Excel: at most 31 characters, none of []:*?/\ , unique.
            let name = sheet.name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
            for (let n = 2; used.has(name.toLowerCase()); n++) name = `${name.slice(0, 28)} ${n}`;
            used.add(name.toLowerCase());

            const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
            ws.columns = sheet.columns.map((c, i) => ({
                header: c.header,
                key: String(i),
                width: c.width ?? Math.min(50, Math.max(10, c.header.length + 2, ...sheet.rows.slice(0, 200).map((r) => String(r[i] ?? '').length + 2))),
                style: formats[c.type] ? { numFmt: formats[c.type] } : {},
            }));
            ws.getRow(1).font = { bold: true };
            for (const row of sheet.rows) {
                ws.addRow(row.map((v, i) => this.xlsxValue(v, sheet.columns[i].type)));
            }
            if (sheet.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
        }
        return new Uint8Array(await wb.xlsx.writeBuffer());
    }

    /** Dates become real dates (wall time as given: no time zone shift). */
    private xlsxValue(v: Cell, type: ColumnType): string | number | Date | null {
        if (v === null || typeof v === 'number') return v;
        if (type === 'date' && DAY.test(v)) return new Date(`${v}T00:00:00Z`);
        if (type === 'datetime' && DAY_TIME.test(v)) return new Date(`${v.slice(0, 16)}:00Z`);
        if (['number', 'money', 'percent'].includes(type) && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
        return v;
    }
}
