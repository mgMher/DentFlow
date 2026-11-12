import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { addDays, Currency, errorBody, roundMinor, toClinicDateString, toMajor, toMinor } from 'src/common/utils';
import { ToothStatus } from './dental-record.schema';
import { TreatmentEntry, TreatmentEntryDocument, TreatmentEntryStatus } from './treatment-entry.schema';
import {
    TreatmentPlan,
    TreatmentPlanAction,
    TreatmentPlanDocument,
    TreatmentPlanStatus,
} from './treatment-plan.schema';
import { DentalRecordsService } from './dental-records.service';
import { isFdiTooth } from './tooth-numbering';
import {
    AcceptTreatmentPlanDto,
    CloseTreatmentPlanDto,
    CreateTreatmentPlanDto,
    DuplicateTreatmentPlanDto,
    PresentTreatmentPlanDto,
    QueryTreatmentPlansDto,
    TreatmentPlanItemDto,
    UpdateTreatmentPlanDto,
} from './dto';

const S = TreatmentPlanStatus;
const PERSON = 'firstName lastName';
const DEFAULT_VALID_DAYS = 30;
/** Stored as the void reason of items the patient declined; the UI shows its own wording. */
const DECLINED_BY_PATIENT = 'Declined by the patient';

const PLAN_POPULATE = [
    { path: 'dentistId', select: PERSON },
    { path: 'createdBy', select: PERSON },
    { path: 'acceptedBy', select: PERSON },
    { path: 'history.by', select: PERSON },
];

const ITEM_POPULATE = [
    { path: 'dentistId', select: PERSON },
    { path: 'treatmentId', select: 'name nameHy nameRu code' },
    { path: 'completedBy', select: PERSON },
    { path: 'voidedBy', select: PERSON },
    { path: 'invoiceId', select: 'invoiceNumber status' },
];

type Id = string | Types.ObjectId;
const oid = (id: Id) => new Types.ObjectId(id.toString());

type ItemMoney = Pick<TreatmentEntry, 'status' | 'cost' | 'discount' | 'planAccepted'> & { voidedAt?: Date | null };

/** Price after the item's discount, in minor units — rounded exactly as an invoice line rounds it. */
const netMinor = (item: ItemMoney, currency: Currency): number => {
    const gross = toMinor(item.cost ?? 0, currency);
    return gross - roundMinor((gross * (item.discount ?? 0)) / 100);
};

/** Totals and counts for a plan's items, in major units. */
export const summarize = (status: TreatmentPlanStatus, items: ItemMoney[], currency: Currency) => {
    const live = items.filter((i) => !i.voidedAt);
    const sum = (list: ItemMoney[], net = true) =>
        toMajor(
            list.reduce((total, i) => total + (net ? netMinor(i, currency) : toMinor(i.cost ?? 0, currency)), 0),
            currency,
        );
    const done = live.filter((i) => i.status === TreatmentEntryStatus.DONE);
    const decided = [S.ACCEPTED, S.COMPLETED].includes(status);
    const subtotal = sum(live, false);
    const total = sum(live);
    return {
        items: live.length,
        done: done.length,
        declined: items.filter((i) => i.voidedAt && i.planAccepted === false).length,
        subtotal,
        discount: toMajor(toMinor(subtotal, currency) - toMinor(total, currency), currency),
        total,
        doneTotal: sum(done),
        /** What the patient agreed to; null until the plan is accepted. */
        acceptedTotal: decided ? total : null,
    };
};

/**
 * Treatment plans (F1): a priced set of planned treatments given to the
 * patient as an estimate, accepted item by item, then done and billed through
 * the ordinary treatment entries.
 */
@Injectable()
export class TreatmentPlansService {
    constructor(
        @InjectModel(TreatmentPlan.name) private readonly planModel: Model<TreatmentPlanDocument>,
        @InjectModel(TreatmentEntry.name) private readonly entryModel: Model<TreatmentEntryDocument>,
        private readonly clinicRefs: ClinicRefsService,
        private readonly records: DentalRecordsService,
    ) {}

    async findAll(clinicId: Types.ObjectId, query: QueryTreatmentPlansDto) {
        await this.clinicRefs.assertPatient(clinicId, query.patientId);
        const plans = await this.planModel
            .find({ clinicId, patientId: oid(query.patientId), ...(query.status ? { status: query.status } : {}) })
            .sort({ createdAt: -1 })
            .populate({ path: 'dentistId', select: PERSON })
            .lean();
        const items = await this.entryModel
            .find({ planId: { $in: plans.map((p) => p._id) } })
            .select('planId status cost discount planAccepted voidedAt')
            .lean();
        return plans.map((plan) => ({
            ...plan,
            history: undefined,
            summary: summarize(
                plan.status,
                items.filter((i) => i.planId?.equals(plan._id)),
                plan.currency,
            ),
        }));
    }

    async findOne(clinicId: Types.ObjectId, planId: Types.ObjectId) {
        const plan = await this.planModel.findOne({ _id: planId, clinicId }).populate(PLAN_POPULATE).lean();
        if (!plan) throw this.notFound();
        const items = await this.entryModel
            .find({ planId })
            .sort({ stage: 1, createdAt: 1 })
            .populate(ITEM_POPULATE)
            .lean();
        return {
            ...plan,
            items: items.map((item) => ({ ...item, net: toMajor(netMinor(item, plan.currency), plan.currency) })),
            summary: summarize(plan.status, items, plan.currency),
        };
    }

    async create(clinicId: Types.ObjectId, userId: Types.ObjectId, role: Role, dto: CreateTreatmentPlanDto) {
        await this.clinicRefs.assertPatient(clinicId, dto.patientId, { forBooking: true });
        const dentistId = await this.dentistFor(clinicId, userId, role, dto.dentistId);
        const { currency } = await this.clinicRefs.localeOf(clinicId);
        const plan = await this.planModel.create({
            clinicId,
            patientId: oid(dto.patientId),
            title: dto.title,
            dentistId,
            currency,
            notes: dto.notes,
            createdBy: userId,
            history: [{ action: TreatmentPlanAction.CREATED, at: new Date(), by: userId }],
        });
        return this.findOne(clinicId, plan._id);
    }

    /** Title, notes and dentist; drafts only. */
    async update(clinicId: Types.ObjectId, planId: Types.ObjectId, dto: UpdateTreatmentPlanDto) {
        if (dto.dentistId) await this.clinicRefs.assertDentist(clinicId, dto.dentistId);
        const $set: Record<string, unknown> = {};
        if (dto.title !== undefined) $set.title = dto.title;
        if (dto.notes !== undefined) $set.notes = dto.notes;
        if (dto.dentistId) $set.dentistId = oid(dto.dentistId);
        const updated = await this.planModel.updateOne(
            { _id: planId, clinicId, status: S.DRAFT },
            { $set, $inc: { revision: 1 } },
        );
        if (!updated.matchedCount) throw await this.stateError(clinicId, planId, 'edit');
        return this.findOne(clinicId, planId);
    }

    // ── Items (draft only) ───────────────────────────────────────────────────

    async addItem(clinicId: Types.ObjectId, planId: Types.ObjectId, userId: Types.ObjectId, dto: TreatmentPlanItemDto) {
        const plan = await this.touchDraft(clinicId, planId);
        const fields = await this.itemFields(clinicId, plan, dto);
        await this.entryModel.create({
            ...fields,
            clinicId,
            patientId: plan.patientId,
            planId,
            status: TreatmentEntryStatus.PLANNED,
            date: new Date(),
            createdBy: userId,
        });
        return this.findOne(clinicId, planId);
    }

    async updateItem(
        clinicId: Types.ObjectId,
        planId: Types.ObjectId,
        itemId: Types.ObjectId,
        dto: TreatmentPlanItemDto,
    ) {
        const plan = await this.touchDraft(clinicId, planId);
        const fields = await this.itemFields(clinicId, plan, dto);
        const updated = await this.entryModel.updateOne(
            { _id: itemId, planId, status: TreatmentEntryStatus.PLANNED, voidedAt: null },
            { $set: fields },
        );
        if (!updated.matchedCount) throw await this.itemError(planId, itemId);
        return this.findOne(clinicId, planId);
    }

    /** A draft's item was never agreed to or done, so it is deleted rather than voided. */
    async removeItem(clinicId: Types.ObjectId, planId: Types.ObjectId, itemId: Types.ObjectId) {
        await this.touchDraft(clinicId, planId);
        const removed = await this.entryModel.deleteOne({
            _id: itemId,
            planId,
            status: TreatmentEntryStatus.PLANNED,
            voidedAt: null,
            invoiceId: null,
        });
        if (!removed.deletedCount) throw await this.itemError(planId, itemId);
        return this.findOne(clinicId, planId);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    /** The estimate was given to the patient. Needs at least one item still to do. */
    async present(clinicId: Types.ObjectId, planId: Types.ObjectId, userId: Types.ObjectId, dto: PresentTreatmentPlanDto) {
        await this.assertHasOpenItems(planId);
        const today = toClinicDateString(new Date(), await this.clinicRefs.timezoneOf(clinicId));
        const validUntil = dto.validUntil ?? addDays(today, DEFAULT_VALID_DAYS);
        if (validUntil < today) {
            throw new BadRequestException(errorBody('planValidUntilPast', 'The estimate cannot expire in the past'));
        }
        const now = new Date();
        const updated = await this.planModel.updateOne(
            { _id: planId, clinicId, status: S.DRAFT },
            {
                $set: { status: S.PRESENTED, presentedAt: now, validUntil },
                $push: { history: { action: TreatmentPlanAction.PRESENTED, at: now, by: userId } },
            },
        );
        if (!updated.matchedCount) throw await this.stateError(clinicId, planId, 'present');
        return this.findOne(clinicId, planId);
    }

    /**
     * The patient agreed. Items they declined are voided (kept on the plan as
     * declined); the rest are locked at their price. `revision` must be the
     * one the patient was shown, so a change made meanwhile is not accepted
     * unseen.
     */
    async accept(clinicId: Types.ObjectId, planId: Types.ObjectId, userId: Types.ObjectId, dto: AcceptTreatmentPlanDto) {
        const open = await this.entryModel
            .find({ planId, status: TreatmentEntryStatus.PLANNED, voidedAt: null })
            .select('_id')
            .lean();
        const openIds = open.map((i) => i._id.toString());
        const declined = [...new Set(dto.declinedItemIds ?? [])];
        if (declined.some((id) => !openIds.includes(id))) {
            throw new BadRequestException(errorBody('planItemNotFound', 'An item is not open on this plan'));
        }
        const acceptedIds = openIds.filter((id) => !declined.includes(id));
        if (!acceptedIds.length) {
            throw new BadRequestException(
                errorBody('planNothingAccepted', 'Nothing left to accept; decline the plan instead'),
            );
        }

        const now = new Date();
        const updated = await this.planModel.updateOne(
            { _id: planId, clinicId, status: { $in: [S.DRAFT, S.PRESENTED] }, revision: dto.revision },
            {
                $set: { status: S.ACCEPTED, acceptedAt: now, acceptedBy: userId },
                $push: {
                    history: {
                        action: TreatmentPlanAction.ACCEPTED,
                        at: now,
                        by: userId,
                        ...(declined.length ? { note: `${declined.length}` } : {}),
                    },
                },
            },
        );
        if (!updated.matchedCount) {
            const plan = await this.planModel.findOne({ _id: planId, clinicId }).select('status revision').lean();
            if (plan && [S.DRAFT, S.PRESENTED].includes(plan.status)) {
                throw new ConflictException(
                    errorBody('planChanged', 'The plan was changed after it was shown; review it again'),
                );
            }
            throw await this.stateError(clinicId, planId, 'accept');
        }

        await Promise.all([
            this.entryModel.updateMany({ planId, _id: { $in: acceptedIds.map(oid) } }, { $set: { planAccepted: true } }),
            declined.length &&
                this.entryModel.updateMany(
                    { planId, _id: { $in: declined.map(oid) }, status: TreatmentEntryStatus.PLANNED, voidedAt: null },
                    { $set: { planAccepted: false, voidedAt: now, voidedBy: userId, voidReason: DECLINED_BY_PATIENT } },
                ),
        ]);
        await this.records.settlePlan(planId, userId);
        return this.findOne(clinicId, planId);
    }

    /** The patient said no to the whole plan. Final; its open items are voided. */
    async decline(clinicId: Types.ObjectId, planId: Types.ObjectId, userId: Types.ObjectId, dto: CloseTreatmentPlanDto) {
        return this.close(clinicId, planId, userId, dto.reason, S.DECLINED, [S.DRAFT, S.PRESENTED]);
    }

    /** Withdrawn by the clinic (e.g. the patient chose another option). Final; done items stay. */
    async cancel(clinicId: Types.ObjectId, planId: Types.ObjectId, userId: Types.ObjectId, dto: CloseTreatmentPlanDto) {
        return this.close(clinicId, planId, userId, dto.reason, S.CANCELLED, [S.DRAFT, S.PRESENTED, S.ACCEPTED]);
    }

    /** Back to draft to change it. Acceptance is cleared; done items stay done. */
    async revise(clinicId: Types.ObjectId, planId: Types.ObjectId, userId: Types.ObjectId) {
        const now = new Date();
        const updated = await this.planModel.updateOne(
            { _id: planId, clinicId, status: { $in: [S.PRESENTED, S.ACCEPTED] } },
            {
                $set: { status: S.DRAFT },
                $unset: { acceptedAt: '', acceptedBy: '' },
                $inc: { revision: 1 },
                $push: { history: { action: TreatmentPlanAction.REVISED, at: now, by: userId } },
            },
        );
        if (!updated.matchedCount) throw await this.stateError(clinicId, planId, 'revise');
        await this.entryModel.updateMany(
            { planId, status: TreatmentEntryStatus.PLANNED, voidedAt: null },
            { $unset: { planAccepted: '' } },
        );
        return this.findOne(clinicId, planId);
    }

    /** A new draft with the same items (still to do), e.g. to offer an alternative or re-offer a declined plan. */
    async duplicate(
        clinicId: Types.ObjectId,
        planId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: DuplicateTreatmentPlanDto,
    ) {
        const source = await this.planModel.findOne({ _id: planId, clinicId }).lean();
        if (!source) throw this.notFound();
        await this.clinicRefs.assertPatient(clinicId, source.patientId, { forBooking: true });
        const { currency } = await this.clinicRefs.localeOf(clinicId);
        // Live items, declined ones, and those voided by closing the plan (not ones voided as mistakes).
        const items = await this.entryModel
            .find({
                planId,
                $or: [
                    { voidedAt: null },
                    { planAccepted: false },
                    ...(source.closedAt ? [{ voidedAt: { $gte: source.closedAt } }] : []),
                ],
            })
            .sort({ stage: 1, createdAt: 1 })
            .lean();

        const now = new Date();
        const copy = await this.planModel.create({
            clinicId,
            patientId: source.patientId,
            title: dto.title ?? source.title,
            dentistId: source.dentistId,
            currency,
            notes: source.notes,
            createdBy: userId,
            history: [{ action: TreatmentPlanAction.CREATED, at: now, by: userId }],
        });
        if (items.length) {
            await this.entryModel.insertMany(
                items.map((i) => ({
                    clinicId,
                    patientId: source.patientId,
                    planId: copy._id,
                    status: TreatmentEntryStatus.PLANNED,
                    teeth: i.teeth,
                    treatmentId: i.treatmentId,
                    treatmentName: i.treatmentName,
                    surfaces: i.surfaces,
                    resultStatus: i.resultStatus,
                    dentistId: i.dentistId,
                    // Priced again only if the clinic changed currency since.
                    cost: i.currency === currency ? i.cost : 0,
                    currency,
                    discount: i.discount,
                    stage: i.stage,
                    notes: i.notes,
                    date: now,
                    createdBy: userId,
                })),
            );
        }
        return this.findOne(clinicId, copy._id);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async close(
        clinicId: Types.ObjectId,
        planId: Types.ObjectId,
        userId: Types.ObjectId,
        reason: string,
        to: TreatmentPlanStatus.DECLINED | TreatmentPlanStatus.CANCELLED,
        from: TreatmentPlanStatus[],
    ) {
        const now = new Date();
        const updated = await this.planModel.updateOne(
            { _id: planId, clinicId, status: { $in: from } },
            {
                $set: { status: to, closedAt: now, closeReason: reason },
                $push: {
                    history: {
                        action: to === S.DECLINED ? TreatmentPlanAction.DECLINED : TreatmentPlanAction.CANCELLED,
                        at: now,
                        by: userId,
                        note: reason,
                    },
                },
            },
        );
        if (!updated.matchedCount) throw await this.stateError(clinicId, planId, to === S.DECLINED ? 'decline' : 'cancel');
        // Nothing is left planned on the chart for a plan that will not happen.
        await this.entryModel.updateMany(
            { planId, status: TreatmentEntryStatus.PLANNED, voidedAt: null, invoiceId: null },
            {
                $set: {
                    voidedAt: now,
                    voidedBy: userId,
                    voidReason: reason,
                    ...(to === S.DECLINED ? { planAccepted: false } : {}),
                },
            },
        );
        return this.findOne(clinicId, planId);
    }

    /** A draft, marked changed. Every item write goes through this first. */
    private async touchDraft(clinicId: Types.ObjectId, planId: Types.ObjectId) {
        const plan = await this.planModel
            .findOneAndUpdate({ _id: planId, clinicId, status: S.DRAFT }, { $inc: { revision: 1 } }, { new: true })
            .lean();
        if (!plan) throw await this.stateError(clinicId, planId, 'edit');
        return plan;
    }

    private async itemFields(
        clinicId: Types.ObjectId,
        plan: Pick<TreatmentPlan, 'dentistId' | 'currency'>,
        dto: TreatmentPlanItemDto,
    ) {
        const teeth = [...new Set(dto.teeth ?? [])].sort((a, b) => a - b);
        const invalid = teeth.filter((n) => !isFdiTooth(n));
        if (invalid.length) {
            throw new BadRequestException(errorBody('invalidTooth', `Not FDI tooth numbers: ${invalid.join(', ')}`));
        }
        toMinor(dto.cost, plan.currency); // rejects 100.5 AMD
        const [treatment] = await Promise.all([
            dto.treatmentId ? this.clinicRefs.getTreatment(clinicId, dto.treatmentId) : null,
            dto.dentistId && this.clinicRefs.assertDentist(clinicId, dto.dentistId),
        ]);
        return {
            teeth,
            treatmentId: dto.treatmentId ? oid(dto.treatmentId) : undefined,
            treatmentName: dto.treatmentName,
            // Surfaces only make sense on one tooth.
            surfaces: teeth.length === 1 ? dto.surfaces ?? [] : [],
            resultStatus: teeth.length ? dto.resultStatus ?? (treatment?.toothStatus as ToothStatus | undefined) : undefined,
            dentistId: dto.dentistId ? oid(dto.dentistId) : plan.dentistId,
            cost: dto.cost,
            currency: plan.currency,
            discount: dto.discount ?? 0,
            stage: dto.stage ?? 1,
            notes: dto.notes,
        };
    }

    private async dentistFor(clinicId: Types.ObjectId, userId: Types.ObjectId, role: Role, dentistId?: string) {
        if (dentistId) {
            await this.clinicRefs.assertDentist(clinicId, dentistId);
            return oid(dentistId);
        }
        if (role === Role.DENTIST) return userId;
        throw new BadRequestException(errorBody('planDentistRequired', 'Choose the dentist responsible for the plan'));
    }

    private async assertHasOpenItems(planId: Types.ObjectId) {
        const open = await this.entryModel.exists({ planId, status: TreatmentEntryStatus.PLANNED, voidedAt: null });
        if (!open) throw new BadRequestException(errorBody('planEmpty', 'Add at least one treatment to the plan first'));
    }

    private notFound() {
        return new NotFoundException(errorBody('treatmentPlanNotFound', 'Treatment plan not found'));
    }

    /** Why a conditional plan update matched nothing. */
    private async stateError(clinicId: Types.ObjectId, planId: Types.ObjectId, operation: string) {
        const plan = await this.planModel.findOne({ _id: planId, clinicId }).select('status').lean();
        if (!plan) return this.notFound();
        if (operation === 'edit') {
            return new BadRequestException(
                errorBody('planNotEditable', `A ${plan.status} plan cannot be changed; revise it first`),
            );
        }
        return new BadRequestException(
            errorBody('invalidPlanTransition', `Cannot ${operation} a plan that is ${plan.status}`),
        );
    }

    private async itemError(planId: Types.ObjectId, itemId: Types.ObjectId) {
        const item = await this.entryModel.findOne({ _id: itemId, planId }).select('status voidedAt').lean();
        if (!item) return new NotFoundException(errorBody('planItemNotFound', 'Item not found on this plan'));
        if (item.status === TreatmentEntryStatus.DONE) {
            return new BadRequestException(errorBody('planItemDone', 'This item is already done'));
        }
        return new BadRequestException(errorBody('treatmentEntryVoided', 'This entry was voided'));
    }
}
