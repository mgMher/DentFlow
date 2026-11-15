import api from '../api/axios';

/** F11: how a column's cells are written (real numbers and dates in Excel). */
export type ExportColumnType = 'text' | 'number' | 'money' | 'percent' | 'date' | 'datetime';
export type ExportCell = string | number | null;

export interface ExportSheet {
    name: string;
    columns: { header: string; type: ExportColumnType; width?: number }[];
    rows: ExportCell[][];
}

export type ExportFormat = 'xlsx' | 'csv';

/** Dates as `YYYY-MM-DD` (clinic day) and times as local wall time, so Excel shows what the page shows. */
export const exportDateTime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** The server writes the file (exceljs / CSV with BOM); the browser saves it. */
export async function downloadExport(format: ExportFormat, filename: string, sheets: ExportSheet[], moneyDecimals = 0) {
    const nonEmpty = sheets.filter((s) => s.columns.length);
    const res = await api.post('/exports', { format, filename, sheets: nonEmpty, moneyDecimals }, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
