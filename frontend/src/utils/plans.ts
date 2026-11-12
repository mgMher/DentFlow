import { TreatmentPlan, TreatmentPlanItem, TreatmentPlanStatus } from '../types';

/** Statuses in which a plan's items can still be changed or its answer recorded. */
export const PLAN_OPEN: TreatmentPlanStatus[] = ['draft', 'presented', 'accepted'];

export const planLink = (plan: Pick<TreatmentPlan, '_id' | 'patientId'>) =>
    `/patients/${plan.patientId}/plans/${plan._id}`;

/** An item still to do: planned and not voided (declined items are voided). */
export const isOpenItem = (item: TreatmentPlanItem) => item.status === 'planned' && !item.voidedAt;

/** Declined by the patient when the plan was accepted (or with the whole plan). */
export const isDeclinedItem = (item: TreatmentPlanItem) => !!item.voidedAt && item.planAccepted === false;

/** Items grouped by stage, in stage order, with each stage's total of live items. */
export const byStage = (items: TreatmentPlanItem[]) => {
    const stages: Record<number, TreatmentPlanItem[]> = {};
    items.forEach((item) => {
        const stage = item.stage ?? 1;
        stages[stage] = [...(stages[stage] ?? []), item];
    });
    return Object.keys(stages)
        .map(Number)
        .sort((a, b) => a - b)
        .map((stage) => ({
            stage,
            items: stages[stage],
            // Rounded per item on the server already; summing in cents here is safe.
            total:
                Math.round(
                    stages[stage].filter((i) => !i.voidedAt).reduce((sum: number, i) => sum + i.net * 100, 0),
                ) / 100,
        }));
};

/** Past its valid-until day while still waiting for an answer. */
export const isExpired = (plan: Pick<TreatmentPlan, 'status' | 'validUntil'>, today: string) =>
    plan.status === 'presented' && !!plan.validUntil && plan.validUntil < today;

const MINOR_FACTOR: Record<string, number> = { AMD: 1, USD: 100, RUB: 100 };

/** Price after a percent discount, rounded as the server and invoice lines round it (the discount, to the minor unit). */
export const netPrice = (cost: number, discount: number, currency: string) => {
    const factor = MINOR_FACTOR[currency] ?? 100;
    const gross = Math.round(cost * factor);
    return (gross - Math.round((gross * discount) / 100)) / factor;
};
