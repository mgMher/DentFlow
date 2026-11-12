import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AUDIT_AREAS } from './audit.config';
import { diffFields, pickDetails, snapshot } from './audit-diff';

const controllers = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return controllers(path);
        return name.endsWith('.controller.ts') ? [path] : [];
    });

describe('audit config', () => {
    it('gives every controller an area (or says it is not logged)', () => {
        const classes = controllers(join(__dirname, '..')).flatMap((file) =>
            Array.from(readFileSync(file, 'utf8').matchAll(/export class (\w+Controller)\b/g)).map((m) => m[1]),
        );
        expect(classes.length).toBeGreaterThan(15);
        expect(classes.filter((c) => !(c in AUDIT_AREAS))).toEqual([]);
    });
});

describe('diffFields', () => {
    it('lists changed fields only, one level into objects', () => {
        const before = { phone: '+37491000000', medicalHistory: { allergies: ['penicillin'], bloodType: 'A+' }, notes: 'x' };
        const after = { phone: '+37491111111', medicalHistory: { allergies: ['penicillin', 'latex'], bloodType: 'A+' }, notes: 'x' };
        expect(diffFields(before, after, ['phone', 'medicalHistory', 'notes'])).toEqual([
            { field: 'phone', from: '+37491000000', to: '+37491111111' },
            { field: 'medicalHistory.allergies', from: ['penicillin'], to: ['penicillin', 'latex'] },
        ]);
    });

    it('masks secrets and pictures', () => {
        expect(diffFields({ photo: 'data:a' }, { photo: 'data:b' }, ['photo'])).toEqual([{ field: 'photo', masked: true }]);
    });

    it('ignores sub-document ids and timestamps, normalises dates and ids', () => {
        const at = new Date('2026-11-12T10:00:00Z');
        const before = { items: [{ _id: 'a1', name: 'Filling' }], when: at, updatedAt: new Date(1) };
        const after = { items: [{ _id: 'b2', name: 'Filling' }], when: new Date(at), updatedAt: new Date(2) };
        expect(diffFields(before, after, ['items', 'when', 'updatedAt'])).toEqual([]);
        expect(snapshot(at)).toBe('2026-11-12T10:00:00.000Z');
    });

    it('cuts very long values', () => {
        const [c] = diffFields({ notes: '' }, { notes: 'x'.repeat(5000) }, ['notes']);
        expect(String(c.to).length).toBeLessThan(2100);
    });
});

describe('pickDetails', () => {
    it('keeps identifying values, never passwords', () => {
        expect(pickDetails({ reason: 'Wrong patient', password: 'secret' }, { invoiceNumber: 'INV-1', amount: 5000, temporaryPassword: 'x' })).toEqual({
            invoiceNumber: 'INV-1',
            amount: 5000,
            reason: 'Wrong patient',
        });
    });
});
