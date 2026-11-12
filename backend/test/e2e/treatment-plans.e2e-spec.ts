import { Clinic, Staff, startApp, TestApp } from './app';

/** F1: plans from draft to completed, money that matches the invoice, roles, races and tenancy. Prices in AMD. */
describe('Treatment plans (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let dentist: Staff, recep: Staff, assistant: Staff;
    let patient: any;

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Plans');
        dentist = await t.addStaff(C, 'dentist', 'PlanDentist');
        recep = await t.addStaff(C, 'receptionist');
        assistant = await t.addStaff(C, 'assistant');
        patient = await t.addPatient(C.token, 'Planned');
    });
    afterAll(() => t.close());

    const newPlan = async (title = 'Option A', token = dentist.token) => {
        const r = await t.api.post('/treatment-plans', token, { patientId: patient._id, title });
        expect(r.status).toBe(201);
        return r.data;
    };
    const addItem = (planId: string, body: Record<string, unknown>, token = dentist.token) =>
        t.api.post(`/treatment-plans/${planId}/items`, token, body);
    const implant = { teeth: [36], treatmentName: 'Implant', cost: 250000, discount: 10, stage: 1, resultStatus: 'implant' };
    const crown = { teeth: [36], treatmentName: 'Crown', cost: 120000, stage: 2 };
    const cleaning = { treatmentName: 'Cleaning', cost: 15000, stage: 1 };
    const itemNamed = (plan: any, name: string) => plan.items.find((i: any) => i.treatmentName === name);
    const complete = (itemId: string) =>
        t.api.patch(`/dental-records/${patient._id}/treatment-entry/${itemId}/complete`, dentist.token, {});

    describe('who may do what', () => {
        it('a dentist creates a plan for themself; an admin must name the dentist', async () => {
            const plan = await newPlan();
            expect(plan.status).toBe('draft');
            expect(plan.dentistId._id).toBe(dentist.authId);
            expect(plan.currency).toBe('AMD');

            const noDentist = await t.api.post('/treatment-plans', C.token, { patientId: patient._id, title: 'X' });
            expect(noDentist.status).toBe(400);
            expect(noDentist.body.code).toBe('planDentistRequired');
            const named = await t.api.post('/treatment-plans', C.token, {
                patientId: patient._id,
                title: 'By admin',
                dentistId: dentist.authId,
            });
            expect(named.status).toBe(201);
        });

        it('reception and assistants cannot build plans, but everyone can read them', async () => {
            const plan = await newPlan();
            expect((await t.api.post('/treatment-plans', recep.token, { patientId: patient._id, title: 'X' })).status).toBe(403);
            expect((await addItem(plan._id, cleaning, recep.token)).status).toBe(403);
            expect((await addItem(plan._id, cleaning, assistant.token)).status).toBe(403);
            expect((await t.api.get(`/treatment-plans/${plan._id}`, assistant.token)).status).toBe(200);
            expect((await t.api.get(`/treatment-plans?patientId=${patient._id}`, recep.token)).status).toBe(200);
        });

        it('an archived patient gets no new plans', async () => {
            const gone = await t.addPatient(C.token, 'Gone');
            await t.api.patch(`/patients/${gone._id}/status`, C.token, { status: 'archived' });
            const r = await t.api.post('/treatment-plans', dentist.token, { patientId: gone._id, title: 'X' });
            expect(r.body.code).toBe('patientClosed');
        });
    });

    describe('draft editing and totals', () => {
        it('adds, changes and removes items; totals use the per-item discount', async () => {
            const plan = await newPlan();
            await addItem(plan._id, implant);
            await addItem(plan._id, crown);
            const withCleaning = (await addItem(plan._id, cleaning)).data;
            expect(withCleaning.items).toHaveLength(3);
            // Stage first, then the order added.
            expect(withCleaning.items.map((i: any) => i.treatmentName)).toEqual(['Implant', 'Cleaning', 'Crown']);
            expect(itemNamed(withCleaning, 'Implant').net).toBe(225000);
            expect(withCleaning.summary).toMatchObject({
                items: 3,
                subtotal: 385000,
                discount: 25000,
                total: 360000,
                acceptedTotal: null,
            });

            const changed = await t.api.patch(
                `/treatment-plans/${plan._id}/items/${itemNamed(withCleaning, 'Cleaning')._id}`,
                dentist.token,
                { ...cleaning, cost: 20000, discount: 50 },
            );
            expect(changed.status).toBe(200);
            expect(changed.data.summary.total).toBe(355000);

            const removed = await t.api.del(`/treatment-plans/${plan._id}/items/${itemNamed(withCleaning, 'Crown')._id}`, dentist.token);
            expect(removed.data.items).toHaveLength(2);
            expect(removed.data.revision).toBe(5);
        });

        it('rejects bad teeth, fractional drams and a 101% discount', async () => {
            const plan = await newPlan();
            expect((await addItem(plan._id, { ...crown, teeth: [19] })).body.code).toBe('invalidTooth');
            expect((await addItem(plan._id, { ...crown, cost: 100.5 })).body.code).toBe('amountPrecision');
            expect((await addItem(plan._id, { ...crown, discount: 101 })).status).toBe(400);
        });

        it('plan items show on the patient\'s treatment list as planned, with the plan named', async () => {
            const plan = await newPlan('Visible plan');
            await addItem(plan._id, { teeth: [11], treatmentName: 'Veneer', cost: 90000 });
            const history = await t.api.get(`/dental-records/${patient._id}/treatment-history?status=planned&limit=100`, C.token);
            const veneer = history.data.data.find((e: any) => e.treatmentName === 'Veneer');
            expect(veneer.planId.title).toBe('Visible plan');
        });
    });

    describe('present → accept → done → completed', () => {
        it('runs the whole lifecycle and the invoice matches the estimate', async () => {
            const plan = await newPlan();
            await t.api.post(`/treatment-plans/${plan._id}/items`, dentist.token, implant);
            await addItem(plan._id, crown);
            const draft = (await addItem(plan._id, cleaning)).data;

            const presented = await t.api.patch(`/treatment-plans/${plan._id}/present`, dentist.token, {});
            expect(presented.status).toBe(200);
            expect(presented.data.status).toBe('presented');
            expect(presented.data.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Locked once shown.
            const late = await addItem(plan._id, crown);
            expect(late.status).toBe(400);
            expect(late.body.code).toBe('planNotEditable');

            // Accepting a version the patient was not shown is refused.
            const stale = await t.api.patch(`/treatment-plans/${plan._id}/accept`, recep.token, { revision: draft.revision - 1 });
            expect(stale.status).toBe(409);
            expect(stale.body.code).toBe('planChanged');

            // Reception records the answer: the patient declines the cleaning.
            const accepted = await t.api.patch(`/treatment-plans/${plan._id}/accept`, recep.token, {
                revision: presented.data.revision,
                declinedItemIds: [itemNamed(draft, 'Cleaning')._id],
            });
            expect(accepted.status).toBe(200);
            expect(accepted.data.status).toBe('accepted');
            expect(accepted.data.acceptedBy.firstName).toBe('receptionist');
            expect(accepted.data.summary).toMatchObject({ items: 2, declined: 1, total: 345000, acceptedTotal: 345000 });
            const declined = itemNamed(accepted.data, 'Cleaning');
            expect(declined.planAccepted).toBe(false);
            expect(declined.voidedAt).toBeTruthy();

            // Doing one item leaves the plan accepted; doing the last completes it.
            const implantId = itemNamed(accepted.data, 'Implant')._id;
            expect((await complete(implantId)).status).toBe(200);
            expect((await t.api.get(`/treatment-plans/${plan._id}`, C.token)).data.status).toBe('accepted');
            expect((await complete(itemNamed(accepted.data, 'Crown')._id)).status).toBe(200);
            const finished = (await t.api.get(`/treatment-plans/${plan._id}`, C.token)).data;
            expect(finished.status).toBe('completed');
            expect(finished.summary.doneTotal).toBe(345000);
            expect(finished.history.map((h: any) => h.action)).toEqual(['created', 'presented', 'accepted', 'completed']);

            // The chart shows tooth 36 as an implant (from the implant's result status).
            const chart = await t.api.get(`/dental-records/${patient._id}/chart`, C.token);
            expect(chart.data.teeth.find((x: any) => x.toothNumber === 36).status).toBe('implant');
            // Completed is final.
            expect((await t.api.patch(`/treatment-plans/${plan._id}/revise`, dentist.token)).body.code).toBe('invalidPlanTransition');

            // Billing the implant at its agreed discount gives the estimate's price.
            const unbilled = await t.api.get(`/billing/patients/${patient._id}/unbilled-treatments`, C.token);
            const entry = unbilled.data.find((e: any) => e._id === implantId);
            expect(entry.discount).toBe(10);
            const invoice = await t.api.post('/billing/invoices', recep.token, {
                patientId: patient._id,
                items: [{ description: entry.treatmentName, unitPrice: entry.cost, discount: entry.discount, treatmentEntryId: entry._id }],
            });
            expect(invoice.status).toBe(201);
            expect(invoice.data.totalAmount).toBe(itemNamed(finished, 'Implant').net);
        });

        it('an empty plan cannot be presented, nor with an expiry in the past', async () => {
            const empty = await newPlan();
            expect((await t.api.patch(`/treatment-plans/${empty._id}/present`, dentist.token, {})).body.code).toBe('planEmpty');
            expect(
                (await t.api.patch(`/treatment-plans/${empty._id}/present`, dentist.token, { validUntil: '2020-01-01' })).status,
            ).toBe(400);
        });

        it('declining every item through accept is refused (decline the plan instead)', async () => {
            const plan = await newPlan();
            const draft = (await addItem(plan._id, cleaning)).data;
            const r = await t.api.patch(`/treatment-plans/${plan._id}/accept`, recep.token, {
                revision: draft.revision,
                declinedItemIds: [draft.items[0]._id],
            });
            expect(r.body.code).toBe('planNothingAccepted');
        });

        it('two people accepting at once: one wins', async () => {
            const plan = await newPlan();
            const draft = (await addItem(plan._id, cleaning)).data;
            const results = await Promise.all([
                t.api.patch(`/treatment-plans/${plan._id}/accept`, recep.token, { revision: draft.revision }),
                t.api.patch(`/treatment-plans/${plan._id}/accept`, dentist.token, { revision: draft.revision }),
            ]);
            expect(results.filter((r) => r.status === 200)).toHaveLength(1);
            const final = (await t.api.get(`/treatment-plans/${plan._id}`, C.token)).data;
            expect(final.history.filter((h: any) => h.action === 'accepted')).toHaveLength(1);
        });
    });

    describe('revise, decline, cancel, duplicate', () => {
        it('revise sends an accepted plan back to draft and clears acceptance', async () => {
            const plan = await newPlan();
            const draft = (await addItem(plan._id, crown)).data;
            await t.api.patch(`/treatment-plans/${plan._id}/accept`, dentist.token, { revision: draft.revision });
            const revised = await t.api.patch(`/treatment-plans/${plan._id}/revise`, dentist.token);
            expect(revised.status).toBe(200);
            expect(revised.data.status).toBe('draft');
            expect(revised.data.acceptedAt).toBeUndefined();
            expect(revised.data.items[0].planAccepted).toBeUndefined();
            expect(revised.data.summary.acceptedTotal).toBeNull();
            expect((await addItem(plan._id, cleaning)).status).toBe(201);
            // Reception may record answers but not revise.
            expect((await t.api.patch(`/treatment-plans/${plan._id}/revise`, recep.token)).status).toBe(403);
        });

        it('decline is final and clears the planned items off the chart', async () => {
            const plan = await newPlan();
            await addItem(plan._id, crown);
            await t.api.patch(`/treatment-plans/${plan._id}/present`, dentist.token, {});
            const declined = await t.api.patch(`/treatment-plans/${plan._id}/decline`, recep.token, { reason: 'Too expensive' });
            expect(declined.data.status).toBe('declined');
            expect(declined.data.closeReason).toBe('Too expensive');
            expect(declined.data.items.every((i: any) => i.voidedAt && i.planAccepted === false)).toBe(true);
            expect((await t.api.patch(`/treatment-plans/${plan._id}/revise`, dentist.token)).body.code).toBe('invalidPlanTransition');
            expect((await t.api.patch(`/treatment-plans/${plan._id}/decline`, recep.token, { reason: 'Again' })).status).toBe(400);
        });

        it('cancel keeps done work and voids the rest; duplicate re-offers it as a new draft', async () => {
            const plan = await newPlan('Original');
            await addItem(plan._id, implant);
            const draft = (await addItem(plan._id, crown)).data;
            const accepted = (await t.api.patch(`/treatment-plans/${plan._id}/accept`, dentist.token, { revision: draft.revision })).data;
            await complete(itemNamed(accepted, 'Implant')._id);

            const cancelled = await t.api.patch(`/treatment-plans/${plan._id}/cancel`, dentist.token, { reason: 'Moved abroad' });
            expect(cancelled.data.status).toBe('cancelled');
            expect(itemNamed(cancelled.data, 'Implant').status).toBe('done');
            expect(itemNamed(cancelled.data, 'Implant').voidedAt).toBeUndefined();
            expect(itemNamed(cancelled.data, 'Crown').voidedAt).toBeTruthy();

            const copy = await t.api.post(`/treatment-plans/${plan._id}/duplicate`, dentist.token, { title: 'Option B' });
            expect(copy.status).toBe(201);
            expect(copy.data.status).toBe('draft');
            expect(copy.data.title).toBe('Option B');
            expect(copy.data.items.map((i: any) => [i.treatmentName, i.status, i.discount])).toEqual([
                ['Implant', 'planned', 10],
                ['Crown', 'planned', 0],
            ]);
        });

        it('the list shows every plan with its totals, newest first', async () => {
            const r = await t.api.get(`/treatment-plans?patientId=${patient._id}`, C.token);
            expect(r.status).toBe(200);
            expect(r.data.length).toBeGreaterThan(5);
            expect(r.data[0].summary).toBeDefined();
            expect(r.data[0].history).toBeUndefined();
            const statuses = await t.api.get(`/treatment-plans?patientId=${patient._id}&status=completed`, C.token);
            expect(statuses.data.every((p: any) => p.status === 'completed')).toBe(true);
        });
    });

    describe('tenancy', () => {
        it("another clinic cannot see or touch this clinic's plans or patients", async () => {
            const plan = await newPlan();
            const other = await t.registerClinic('OtherPlans');
            const otherDentist = await t.addStaff(other, 'dentist');
            expect((await t.api.get(`/treatment-plans/${plan._id}`, other.token)).status).toBe(404);
            expect((await t.api.get(`/treatment-plans?patientId=${patient._id}`, other.token)).status).toBe(404);
            expect((await addItem(plan._id, cleaning, otherDentist.token)).status).toBe(404);
            expect((await t.api.patch(`/treatment-plans/${plan._id}/cancel`, otherDentist.token, { reason: 'Hacked it' })).status).toBe(404);
            expect(
                (await t.api.post('/treatment-plans', otherDentist.token, { patientId: patient._id, title: 'Steal' })).status,
            ).toBe(404);
            expect((await t.api.get(`/treatment-plans/${plan._id}`, C.token)).data.status).toBe('draft');
        });
    });
});
