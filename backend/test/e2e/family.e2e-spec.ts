import { Clinic, Staff, startApp, TestApp } from './app';

/** F8: guardians (a patient or a contact), the family view, and paying for the family. */
describe('Family links (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let recep: Staff, assistant: Staff;
    let mother: any, son: any, daughter: any;

    const family = async (id: string, token = C.token) => (await t.api.get(`/patients/${id}/family`, token)).data;
    const addGuardian = (id: string, body: Record<string, unknown>, token = recep.token) => t.api.post(`/patients/${id}/guardians`, token, body);
    const minor = async (name: string, dateOfBirth: string) => {
        const p = await t.addPatient(recep.token, name);
        await t.api.patch(`/patients/${p._id}`, recep.token, { dateOfBirth });
        return p;
    };

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Family');
        recep = await t.addStaff(C, 'receptionist');
        assistant = await t.addStaff(C, 'assistant');
        mother = await t.addPatient(recep.token, 'Mother');
        son = await minor('Son', '2015-06-01');
        daughter = await minor('Daughter', '2019-02-10');
    });
    afterAll(() => t.close());

    describe('guardians', () => {
        it('links a patient as guardian; the first one is the main one', async () => {
            const r = await addGuardian(son._id, { patientId: mother._id, relationship: 'mother' });
            expect(r.status).toBe(201);
            expect(r.data).toMatchObject({ minor: true, guardians: [{ relationship: 'mother', isPrimary: true, patient: { _id: mother._id, firstName: 'Mother' } }] });
            expect(r.data.age).toBeLessThan(18);
        });

        it('adds a contact who is not a patient; a new main guardian replaces the old', async () => {
            const r = await addGuardian(son._id, { name: 'Davit Grandpa', phone: '091 22 33 44', relationship: 'grandparent', isPrimary: true });
            expect(r.status).toBe(201);
            const [m, g] = r.data.guardians;
            expect(m).toMatchObject({ relationship: 'mother', isPrimary: false });
            expect(g).toMatchObject({ relationship: 'grandparent', isPrimary: true, name: 'Davit Grandpa', phone: '+37491223344' });
            expect(g.patient).toBeUndefined();
        });

        it('changes the main guardian and the relationship; a linked patient is corrected on their own record', async () => {
            const f = await family(son._id);
            const [m, g] = f.guardians;
            const r = await t.api.patch(`/patients/${son._id}/guardians/${m._id}`, recep.token, { isPrimary: true, relationship: 'guardian' });
            expect(r.data.guardians.map((x: any) => [x.relationship, x.isPrimary])).toEqual([
                ['guardian', true],
                ['grandparent', false],
            ]);
            await t.api.patch(`/patients/${son._id}/guardians/${m._id}`, recep.token, { relationship: 'mother' });
            const named = await t.api.patch(`/patients/${son._id}/guardians/${m._id}`, recep.token, { name: 'Renamed' });
            expect(named.body.code).toBe('guardianIsPatient');
            const contact = await t.api.patch(`/patients/${son._id}/guardians/${g._id}`, recep.token, { phone: '+37491999888' });
            expect(contact.data.guardians[1].phone).toBe('+37491999888');
        });

        it('refuses self, duplicates, loops, a contact without a phone, a fifth guardian, unknown kinds', async () => {
            expect((await addGuardian(son._id, { patientId: son._id, relationship: 'other' })).body.code).toBe('guardianIsSelf');
            expect((await addGuardian(son._id, { patientId: mother._id, relationship: 'mother' })).body.code).toBe('guardianAlreadyLinked');
            // The son is now a guardian of nobody, but the mother may not have her son as guardian.
            expect((await addGuardian(mother._id, { patientId: son._id, relationship: 'other' })).body.code).toBe('guardianCycle');
            expect((await addGuardian(son._id, { name: 'No Phone', relationship: 'other' })).status).toBe(400);
            expect((await addGuardian(son._id, { name: 'X', phone: '+37491000001', relationship: 'aunt' })).status).toBe(400);

            const many = await minor('Many', '2018-01-01');
            for (let i = 0; i < 4; i++) {
                expect((await addGuardian(many._id, { name: `G${i}`, phone: `+3749100000${i}`, relationship: 'other' })).status).toBe(201);
            }
            expect((await addGuardian(many._id, { name: 'G5', phone: '+37491000005', relationship: 'other' })).body.code).toBe('tooManyGuardians');
        });

        it('removing the main guardian makes the next one main', async () => {
            const kid = await minor('Removal', '2017-05-05');
            await addGuardian(kid._id, { name: 'First', phone: '+37491000011', relationship: 'father' });
            const two = (await addGuardian(kid._id, { name: 'Second', phone: '+37491000012', relationship: 'mother' })).data;
            const r = await t.api.del(`/patients/${kid._id}/guardians/${two.guardians[0]._id}`, recep.token);
            expect(r.data.guardians).toEqual([expect.objectContaining({ name: 'Second', isPrimary: true })]);
            expect((await t.api.del(`/patients/${kid._id}/guardians/${two.guardians[0]._id}`, recep.token)).body.code).toBe('guardianNotFound');
        });

        it("a guardian's card lists their children; a child's lists siblings", async () => {
            await addGuardian(daughter._id, { patientId: mother._id, relationship: 'mother' });
            const m = await family(mother._id);
            expect(m.minor).toBe(false);
            expect(m.guardians).toEqual([]);
            expect(m.children.map((c: any) => [c.firstName, c.relationship, c.isPrimary])).toEqual(
                expect.arrayContaining([
                    ['Son', 'mother', true],
                    ['Daughter', 'mother', true],
                ]),
            );
            expect((await family(daughter._id)).siblings.map((s: any) => s.firstName)).toEqual(['Son']);
        });

        it('the patient record carries its guardians; a normal edit cannot change them', async () => {
            const p = (await t.api.get(`/patients/${son._id}`, recep.token)).data;
            expect(p.guardians).toHaveLength(2);
            expect((await t.api.patch(`/patients/${son._id}`, recep.token, { guardians: [] })).status).toBe(400);
        });

        it('assistants may look but not change; other clinics see nothing', async () => {
            expect((await t.api.get(`/patients/${son._id}/family`, assistant.token)).status).toBe(200);
            expect((await addGuardian(son._id, { name: 'A', phone: '+37491000099', relationship: 'other' }, assistant.token)).status).toBe(403);
            const other = await t.registerClinic('OtherFamily');
            const stranger = await t.addPatient(other.token, 'Stranger');
            expect((await t.api.get(`/patients/${son._id}/family`, other.token)).status).toBe(404);
            expect((await addGuardian(son._id, { patientId: stranger._id, relationship: 'other' }, other.token)).status).toBe(404);
            // Nor can this clinic link the other clinic's patient.
            expect((await addGuardian(son._id, { patientId: stranger._id, relationship: 'other' })).status).toBe(404);
        });

        it('guardian changes are in the audit log on the child, old → new', async () => {
            const log = (await t.api.get(`/patients/${daughter._id}/history?limit=1`, C.token)).data.items[0];
            expect(log).toMatchObject({ event: 'patients.addGuardian', details: { relationship: 'mother' } });
            expect(log.changes).toEqual([expect.objectContaining({ from: null, to: `mother · primary · patient:${mother._id}` })]);
        });
    });

    describe('paying for the family', () => {
        const invoice = async (patient: any, unitPrice: number) =>
            (await t.api.post('/billing/invoices', recep.token, { patientId: patient._id, issue: true, items: [{ description: 'Work', unitPrice }] })).data;
        let iMother: any, iSon: any, iDaughter: any;

        beforeAll(async () => {
            iSon = await invoice(son, 10000);
            iMother = await invoice(mother, 4000);
            iDaughter = await invoice(daughter, 6000);
        });

        it("the guardian's family account: each member and the totals, open invoices oldest first", async () => {
            const f = (await t.api.get(`/billing/patients/${mother._id}/family-account`, recep.token)).data;
            expect(f.members.map((m: any) => [m.patient.firstName, m.self, m.outstanding])).toEqual([
                ['Mother', true, 4000],
                ['Son', false, 10000],
                ['Daughter', false, 6000],
            ]);
            expect(f).toMatchObject({ outstanding: 20000, credit: 0, balance: 20000 });
            expect(f.openInvoices.map((i: any) => i.invoiceNumber)).toEqual([iSon.invoiceNumber, iMother.invoiceNumber, iDaughter.invoiceNumber]);
        });

        it("an ordinary payment cannot touch a child's invoice", async () => {
            const r = await t.api.post(`/billing/patients/${mother._id}/payments`, recep.token, {
                amount: 1000,
                method: 'cash',
                allocations: [{ invoiceId: iSon._id, amount: 1000 }],
            });
            expect(r.body.code).toBe('invoiceNotOpen');
        });

        it("one family payment fills the family's invoices oldest first; each on its own account, the rest is the payer's credit", async () => {
            const r = await t.api.post(`/billing/patients/${mother._id}/payments`, recep.token, { amount: 25000, method: 'cash', family: true });
            expect(r.status).toBe(201);
            expect(r.data.paid.map((p: any) => [String(p.invoiceId), p.amount])).toEqual([
                [iSon._id, 10000],
                [iMother._id, 4000],
                [iDaughter._id, 6000],
            ]);
            expect(r.data.credit).toBe(5000);
            expect(r.data.family).toMatchObject({ outstanding: 0, credit: 5000, balance: -5000 });

            const sonAccount = (await t.api.get(`/billing/patients/${son._id}/account`, recep.token)).data;
            expect(sonAccount).toMatchObject({ outstanding: 0, credit: 0 });
            const sonPayment = (await t.api.get(`/billing/invoices/${iSon._id}/payments`, C.token)).data[0];
            expect(sonPayment).toMatchObject({ patientId: son._id, paidBy: mother._id, amount: 10000 });
            const motherPayment = (await t.api.get(`/billing/invoices/${iMother._id}/payments`, C.token)).data[0];
            expect(motherPayment.paidBy).toBeUndefined();
            expect((await t.api.get(`/billing/patients/${mother._id}/account`, recep.token)).data.credit).toBe(5000);
        });

        it("a family payment can also be split by hand, including a child's invoice", async () => {
            const i = await invoice(daughter, 3000);
            const r = await t.api.post(`/billing/patients/${mother._id}/payments`, recep.token, {
                amount: 2000,
                method: 'card',
                family: true,
                allocations: [{ invoiceId: i._id, amount: 2000 }],
            });
            expect(r.status).toBe(201);
            expect((await t.api.get(`/billing/invoices/${i._id}`, C.token)).data).toMatchObject({ paidAmount: 2000, status: 'partial' });
        });

        it('a child with no children of their own: the family is just them', async () => {
            const f = (await t.api.get(`/billing/patients/${son._id}/family-account`, recep.token)).data;
            expect(f.members).toHaveLength(1);
            expect((await t.api.get(`/billing/patients/${son._id}/family-account`, assistant.token)).status).toBe(403);
        });
    });
});
