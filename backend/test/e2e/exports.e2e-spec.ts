import { Workbook } from 'exceljs';
import { Clinic, startApp, TestApp } from './app';

/** F11: tables the page shows, written as Excel or CSV. */
describe('Exports (e2e)', () => {
    let t: TestApp;
    let C: Clinic;

    const sheets = [
        {
            name: 'Ատամնաբույժներ',
            columns: [
                { header: 'Անուն', type: 'text' },
                { header: 'Վճարված', type: 'money' },
                { header: 'Տոկոս', type: 'percent' },
                { header: 'Ամսաթիվ', type: 'date' },
                { header: 'Ժամ', type: 'datetime' },
            ],
            rows: [
                ['Անի Հայրապետյան', 120000, 30, '2026-11-01', '2026-11-01T14:30'],
                ['=HYPERLINK("http://evil")', -5000, null, null, null],
                ['Comma, "quoted"', '7500', 12.5, '2026-11-02', null],
            ],
        },
        { name: 'Sheet/with:bad*chars?', columns: [{ header: 'N', type: 'number' }], rows: [[1], [2]] },
    ];

    const post = (body: unknown, token = C.token) =>
        fetch(`${t.url}/exports`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Exports');
    });
    afterAll(() => t.close());

    it('Excel: a sheet per table, header row, real numbers and dates', async () => {
        const res = await post({ format: 'xlsx', filename: 'հաշվետվություն 2026/11', sheets });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('spreadsheetml');
        expect(res.headers.get('content-disposition')).toContain(encodeURIComponent('հաշվետվություն 202611.xlsx'));
        const bytes = new Uint8Array(await res.arrayBuffer());
        expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');

        const wb = new Workbook();
        await wb.xlsx.load(bytes.buffer as ArrayBuffer);
        expect(wb.worksheets.map((w) => w.name)).toEqual(['Ատամնաբույժներ', 'Sheet with bad chars']);
        const ws = wb.worksheets[0];
        expect(ws.getRow(1).values).toEqual([undefined, 'Անուն', 'Վճարված', 'Տոկոս', 'Ամսաթիվ', 'Ժամ']);
        expect(ws.getCell('A2').value).toBe('Անի Հայրապետյան');
        expect(ws.getCell('B2').value).toBe(120000);
        expect(ws.getCell('B2').numFmt).toBe('#,##0');
        expect(ws.getCell('D2').value).toEqual(new Date('2026-11-01T00:00:00Z'));
        expect(ws.getCell('E2').value).toEqual(new Date('2026-11-01T14:30:00Z'));
        // A string that looks like a formula stays a string, never a formula.
        expect(ws.getCell('A3').value).toBe('=HYPERLINK("http://evil")');
        expect(ws.getCell('B4').value).toBe(7500);
    });

    it('CSV: UTF-8 with BOM, quoting, formula-looking text defused, tables one after another', async () => {
        const res = await post({ format: 'csv', filename: 'report', sheets });
        expect(res.headers.get('content-type')).toContain('text/csv');
        const bytes = new Uint8Array(await res.arrayBuffer());
        expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
        const lines = new TextDecoder().decode(bytes.slice(3)).split('\r\n');
        expect(lines[0]).toBe('Ատամնաբույժներ');
        expect(lines[1]).toBe('Անուն,Վճարված,Տոկոս,Ամսաթիվ,Ժամ');
        expect(lines[2]).toBe('Անի Հայրապետյան,120000,30,2026-11-01,2026-11-01 14:30');
        expect(lines[3]).toBe(`"'=HYPERLINK(""http://evil"")",-5000,,,`);
        expect(lines[4]).toBe('"Comma, ""quoted""",7500,12.5,2026-11-02,');
        expect(lines.slice(6, 9)).toEqual(['Sheet/with:bad*chars?', 'N', '1']);
    });

    it('refuses rows that do not fit their columns, odd values, and too many rows', async () => {
        const wide = await post({ format: 'csv', filename: 'x', sheets: [{ name: 'a', columns: [{ header: 'A', type: 'text' }], rows: [['1', '2']] }] });
        expect((await wide.json()).code).toBe('exportBadRow');
        const odd = await post({ format: 'csv', filename: 'x', sheets: [{ name: 'a', columns: [{ header: 'A', type: 'text' }], rows: [[{ a: 1 }]] }] });
        expect((await odd.json()).code).toBe('exportBadRow');
        const many = await post({ format: 'csv', filename: 'x', sheets: [{ name: 'a', columns: [{ header: 'A', type: 'number' }], rows: Array.from({ length: 5001 }, () => [1]) }] });
        expect(many.status).toBe(400);
        expect((await post({ format: 'pdf', filename: 'x', sheets })).status).toBe(400);
    });

    it('needs a signed-in user; nothing is logged in the audit log', async () => {
        expect((await post({ format: 'csv', filename: 'x', sheets }, '')).status).toBe(401);
        const log = (await t.api.get('/audit?limit=200', C.token)).data.items.map((e: any) => e.event);
        expect(log.filter((e: string) => e.startsWith('exports'))).toEqual([]);
    });
});
