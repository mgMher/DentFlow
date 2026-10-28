import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { Treatment, TreatmentDocument, TreatmentCategory, Currency, CODE_INDEX } from './treatment.schema';
import { ToothStatus } from 'src/modules/dental-records/dental-record.schema';
import { runOnce } from 'src/common/migrations/run-once';
import { errorBody, escapeRegex } from 'src/common/utils';
import { CreateTreatmentDto, UpdateTreatmentDto, QueryTreatmentDto } from './dto';

interface DefaultTreatment {
    name: string;
    nameHy: string;
    nameRu: string;
    category: TreatmentCategory;
    code: string;
    duration: number;
    price: { amount: number; currency: Currency };
    toothStatus?: ToothStatus;
}

const DEFAULT_TREATMENTS: DefaultTreatment[] = [
    {
        name: 'Dental Examination',
        nameHy: '\u0531\u057f\u0561\u0574\u0576\u0561\u0562\u0578\u0582\u056a\u0561\u056f\u0561\u0576 \u0566\u0576\u0576\u0578\u0582\u0574',
        nameRu: '\u0421\u0442\u043e\u043c\u0430\u0442\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043e\u0441\u043c\u043e\u0442\u0440',
        category: TreatmentCategory.DIAGNOSTIC,
        code: 'D0150',
        duration: 20,
        price: { amount: 5000, currency: Currency.AMD },
    },
    {
        name: 'Dental X-Ray (Periapical)',
        nameHy: '\u054c\u0565\u0576\u057f\u0563\u0565\u0576 (\u057a\u0565\u0580\u056b\u0561\u057a\u056b\u056f\u0561\u056c)',
        nameRu: '\u0420\u0435\u043d\u0442\u0433\u0435\u043d (\u043f\u0435\u0440\u0438\u0430\u043f\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0439)',
        category: TreatmentCategory.DIAGNOSTIC,
        code: 'D0220',
        duration: 10,
        price: { amount: 3000, currency: Currency.AMD },
    },
    {
        name: 'Panoramic X-Ray',
        nameHy: '\u054a\u0561\u0576\u0578\u0580\u0561\u0574\u0561\u0575\u056b\u0576 \u057c\u0565\u0576\u057f\u0563\u0565\u0576',
        nameRu: '\u041f\u0430\u043d\u043e\u0440\u0430\u043c\u043d\u044b\u0439 \u0441\u043d\u0438\u043c\u043e\u043a',
        category: TreatmentCategory.DIAGNOSTIC,
        code: 'D0330',
        duration: 15,
        price: { amount: 8000, currency: Currency.AMD },
    },
    {
        name: 'Professional Teeth Cleaning',
        nameHy: '\u0544\u0561\u057d\u0576\u0561\u0563\u056b\u057f\u0561\u056f\u0561\u0576 \u0561\u057f\u0561\u0574\u0576\u0565\u0580\u056b \u0574\u0561\u0584\u0580\u0578\u0582\u0574',
        nameRu: '\u041f\u0440\u043e\u0444\u0435\u0441\u0441\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u0430\u044f \u0447\u0438\u0441\u0442\u043a\u0430 \u0437\u0443\u0431\u043e\u0432',
        category: TreatmentCategory.PREVENTIVE,
        code: 'D1110',
        duration: 45,
        price: { amount: 15000, currency: Currency.AMD },
    },
    {
        name: 'Fluoride Treatment',
        nameHy: '\u0556\u057f\u0578\u0580\u056b\u0564\u0561\u0575\u056b\u0576 \u0574\u0577\u0561\u056f\u0578\u0582\u0574',
        nameRu: '\u0424\u0442\u043e\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0437\u0443\u0431\u043e\u0432',
        category: TreatmentCategory.PREVENTIVE,
        code: 'D1206',
        duration: 15,
        price: { amount: 5000, currency: Currency.AMD },
    },
    {
        name: 'Dental Sealant (per tooth)',
        nameHy: '\u0531\u057f\u0561\u0574\u056b \u056e\u0561\u056e\u056f\u0561\u057a\u0561\u057f\u0574\u0561\u0576 \u0576\u0575\u0578\u0582\u0569',
        nameRu: '\u0413\u0435\u0440\u043c\u0435\u0442\u0438\u0437\u0430\u0446\u0438\u044f \u0444\u0438\u0441\u0441\u0443\u0440 (\u0437\u0430 \u0437\u0443\u0431)',
        category: TreatmentCategory.PREVENTIVE,
        code: 'D1351',
        duration: 20,
        price: { amount: 7000, currency: Currency.AMD },
    },
    {
        name: 'Composite Filling (anterior)',
        nameHy: '\u053f\u0578\u0574\u057a\u0578\u0566\u056b\u057f\u0561\u0575\u056b\u0576 \u056c\u0565\u0581\u0561\u057e\u0578\u0580\u0578\u0582\u0574 (\u0561\u057c\u057b\u0587\u056b)',
        nameRu: '\u041a\u043e\u043c\u043f\u043e\u0437\u0438\u0442\u043d\u0430\u044f \u043f\u043b\u043e\u043c\u0431\u0430 (\u043f\u0435\u0440\u0435\u0434\u043d\u0438\u0439)',
        category: TreatmentCategory.GENERAL,
        code: 'D2330',
        toothStatus: ToothStatus.FILLED,
        duration: 30,
        price: { amount: 15000, currency: Currency.AMD },
    },
    {
        name: 'Composite Filling (posterior)',
        nameHy: '\u053f\u0578\u0574\u057a\u0578\u0566\u056b\u057f\u0561\u0575\u056b\u0576 \u056c\u0565\u0581\u0561\u057e\u0578\u0580\u0578\u0582\u0574 (\u0570\u0565\u057f\u0587\u056b)',
        nameRu: '\u041a\u043e\u043c\u043f\u043e\u0437\u0438\u0442\u043d\u0430\u044f \u043f\u043b\u043e\u043c\u0431\u0430 (\u0431\u043e\u043a\u043e\u0432\u043e\u0439)',
        category: TreatmentCategory.GENERAL,
        code: 'D2391',
        toothStatus: ToothStatus.FILLED,
        duration: 40,
        price: { amount: 20000, currency: Currency.AMD },
    },
    {
        name: 'Root Canal Treatment (anterior)',
        nameHy: '\u0531\u0580\u0574\u0561\u057f\u0561\u056f\u0561\u0576 \u056e\u0578\u0580\u0561\u0576\u056b \u0562\u0578\u0582\u056a\u0578\u0582\u0574 (\u0561\u057c\u057b\u0587\u056b)',
        nameRu: '\u041b\u0435\u0447\u0435\u043d\u0438\u0435 \u043a\u043e\u0440\u043d\u0435\u0432\u043e\u0433\u043e \u043a\u0430\u043d\u0430\u043b\u0430 (\u043f\u0435\u0440\u0435\u0434\u043d\u0438\u0439)',
        category: TreatmentCategory.ENDODONTIC,
        code: 'D3310',
        toothStatus: ToothStatus.ROOT_CANAL,
        duration: 60,
        price: { amount: 35000, currency: Currency.AMD },
    },
    {
        name: 'Root Canal Treatment (molar)',
        nameHy: '\u0531\u0580\u0574\u0561\u057f\u0561\u056f\u0561\u0576 \u056e\u0578\u0580\u0561\u0576\u056b \u0562\u0578\u0582\u056a\u0578\u0582\u0574 (\u0561\u0572\u0578\u0580\u056b\u0584)',
        nameRu: '\u041b\u0435\u0447\u0435\u043d\u0438\u0435 \u043a\u043e\u0440\u043d\u0435\u0432\u043e\u0433\u043e \u043a\u0430\u043d\u0430\u043b\u0430 (\u043c\u043e\u043b\u044f\u0440)',
        category: TreatmentCategory.ENDODONTIC,
        code: 'D3330',
        toothStatus: ToothStatus.ROOT_CANAL,
        duration: 90,
        price: { amount: 50000, currency: Currency.AMD },
    },
    {
        name: 'Simple Tooth Extraction',
        nameHy: '\u0531\u057f\u0561\u0574\u056b \u057a\u0561\u0580\u0566 \u0570\u0565\u057c\u0561\u0581\u0578\u0582\u0574',
        nameRu: '\u041f\u0440\u043e\u0441\u0442\u043e\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0437\u0443\u0431\u0430',
        category: TreatmentCategory.SURGICAL,
        code: 'D7140',
        toothStatus: ToothStatus.MISSING,
        duration: 30,
        price: { amount: 10000, currency: Currency.AMD },
    },
    {
        name: 'Surgical Tooth Extraction',
        nameHy: '\u0531\u057f\u0561\u0574\u056b \u057e\u056b\u0580\u0561\u0562\u0578\u0582\u056a\u0561\u056f\u0561\u0576 \u0570\u0565\u057c\u0561\u0581\u0578\u0582\u0574',
        nameRu: '\u0425\u0438\u0440\u0443\u0440\u0433\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0437\u0443\u0431\u0430',
        category: TreatmentCategory.SURGICAL,
        code: 'D7210',
        toothStatus: ToothStatus.MISSING,
        duration: 60,
        price: { amount: 25000, currency: Currency.AMD },
    },
    {
        name: 'Wisdom Tooth Extraction',
        nameHy: '\u053b\u0574\u0561\u057d\u057f\u0578\u0582\u0569\u0575\u0561\u0576 \u0561\u057f\u0561\u0574\u056b \u0570\u0565\u057c\u0561\u0581\u0578\u0582\u0574',
        nameRu: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0437\u0443\u0431\u0430 \u043c\u0443\u0434\u0440\u043e\u0441\u0442\u0438',
        category: TreatmentCategory.SURGICAL,
        code: 'D7230',
        toothStatus: ToothStatus.MISSING,
        duration: 75,
        price: { amount: 40000, currency: Currency.AMD },
    },
    {
        name: 'Porcelain Crown',
        nameHy: '\u0553\u0578\u0580\u0581\u0565\u056c\u0561\u0576\u0565 \u057a\u0561\u057f\u0575\u0561\u0576',
        nameRu: '\u0424\u0430\u0440\u0444\u043e\u0440\u043e\u0432\u0430\u044f \u043a\u043e\u0440\u043e\u043d\u043a\u0430',
        category: TreatmentCategory.PROSTHODONTIC,
        code: 'D2740',
        toothStatus: ToothStatus.CROWN,
        duration: 60,
        price: { amount: 80000, currency: Currency.AMD },
    },
    {
        name: 'Dental Bridge (3 units)',
        nameHy: '\u0531\u057f\u0561\u0574\u0576\u0561\u056f\u0561\u0574\u0578\u0582\u0580\u057b (3 \u0574\u056b\u0561\u057e\u0578\u0580)',
        nameRu: '\u0417\u0443\u0431\u043d\u043e\u0439 \u043c\u043e\u0441\u0442 (3 \u0435\u0434\u0438\u043d\u0438\u0446\u044b)',
        category: TreatmentCategory.PROSTHODONTIC,
        code: 'D6240',
        toothStatus: ToothStatus.BRIDGE,
        duration: 90,
        price: { amount: 150000, currency: Currency.AMD },
    },
    {
        name: 'Teeth Whitening',
        nameHy: '\u0531\u057f\u0561\u0574\u0576\u0565\u0580\u056b \u057d\u057a\u056b\u057f\u0561\u056f\u0578\u0582\u0574',
        nameRu: '\u041e\u0442\u0431\u0435\u043b\u0438\u0432\u0430\u043d\u0438\u0435 \u0437\u0443\u0431\u043e\u0432',
        category: TreatmentCategory.COSMETIC,
        code: 'D9972',
        duration: 60,
        price: { amount: 40000, currency: Currency.AMD },
    },
    {
        name: 'Dental Veneer (porcelain)',
        nameHy: '\u054a\u0578\u0580\u0581\u0565\u056c\u0561\u0576\u0565 \u057e\u056b\u0576\u056b\u0580',
        nameRu: '\u0424\u0430\u0440\u0444\u043e\u0440\u043e\u0432\u044b\u0439 \u0432\u0438\u043d\u0438\u0440',
        category: TreatmentCategory.COSMETIC,
        code: 'D2962',
        toothStatus: ToothStatus.VENEER,
        duration: 60,
        price: { amount: 100000, currency: Currency.AMD },
    },
    {
        name: 'Scaling and Root Planing (per quadrant)',
        nameHy: '\u054d\u056f\u0565\u0575\u056c\u056b\u0576\u0563 \u0587 \u0561\u0580\u0574\u0561\u057f\u0561\u0574\u0561\u056f\u0565\u0580\u0587\u0578\u0582\u0569\u0575\u0561\u0576 \u0570\u0561\u0580\u0569\u0565\u0581\u0578\u0582\u0574',
        nameRu: '\u0421\u043a\u0435\u0439\u043b\u0438\u043d\u0433 \u0438 \u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u043a\u043e\u0440\u043d\u044f (\u0437\u0430 \u043a\u0432\u0430\u0434\u0440\u0430\u043d\u0442)',
        category: TreatmentCategory.PERIODONTIC,
        code: 'D4341',
        duration: 45,
        price: { amount: 20000, currency: Currency.AMD },
    },
    {
        name: 'Orthodontic Braces (full)',
        nameHy: '\u0548\u0582\u0572\u0572\u056b\u0579 \u0562\u0580\u0565\u056f\u0565\u057f\u0576\u0565\u0580 (\u056c\u056b\u0561\u0580\u056a\u0565\u0584)',
        nameRu: '\u041e\u0440\u0442\u043e\u0434\u043e\u043d\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0431\u0440\u0435\u043a\u0435\u0442\u044b (\u043f\u043e\u043b\u043d\u044b\u0435)',
        category: TreatmentCategory.ORTHODONTIC,
        code: 'D8080',
        duration: 120,
        price: { amount: 150000, currency: Currency.AMD },
    },
    {
        name: 'Pediatric Dental Exam',
        nameHy: '\u0544\u0561\u0576\u056f\u0561\u056f\u0561\u0576 \u0561\u057f\u0561\u0574\u0576\u0561\u0562\u0578\u0582\u056a\u0561\u056f\u0561\u0576 \u0566\u0576\u0576\u0578\u0582\u0574',
        nameRu: '\u0414\u0435\u0442\u0441\u043a\u0438\u0439 \u0441\u0442\u043e\u043c\u0430\u0442\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043e\u0441\u043c\u043e\u0442\u0440',
        category: TreatmentCategory.PEDIATRIC,
        code: 'D0145',
        duration: 20,
        price: { amount: 5000, currency: Currency.AMD },
    },
];

@Injectable()
export class TreatmentsService implements OnModuleInit {
    private readonly logger = new Logger(TreatmentsService.name);

    constructor(
        @InjectModel(Treatment.name) private readonly treatmentModel: Model<TreatmentDocument>,
        @InjectConnection() private readonly connection: Connection,
    ) {}

    /** One-off data fixes; each runs once per database (see `runOnce`). */
    async onModuleInit(): Promise<void> {
        await runOnce(this.connection, '2026-10-treatment-code-unique', this.logger, () => this.makeCodesUnique());
        await runOnce(this.connection, '2026-10-treatment-tooth-status', this.logger, () => this.backfillToothStatus());
    }

    /**
     * Codes become unique per clinic. Existing duplicates (the demo seed and
     * the register seed both used the same codes) get a `-2`, `-3` suffix so
     * the index can be built; the old non-unique index is dropped.
     */
    private async makeCodesUnique(): Promise<number> {
        const collection = this.treatmentModel.collection;
        const duplicates = await collection
            .aggregate<{ ids: Types.ObjectId[]; code: string }>([
                { $match: { code: { $type: 'string', $gt: '' } } },
                { $sort: { createdAt: 1, _id: 1 } },
                { $group: { _id: { clinicId: '$clinicId', code: { $toUpper: '$code' } }, ids: { $push: '$_id' } } },
                { $match: { 'ids.1': { $exists: true } } },
                { $project: { ids: 1, code: '$_id.code' } },
            ])
            .toArray();

        let renamed = 0;
        for (const { ids, code } of duplicates) {
            for (const [i, id] of ids.slice(1).entries()) {
                await collection.updateOne({ _id: id }, { $set: { code: `${code}-${i + 2}` } });
                this.logger.warn(`Treatment ${id}: duplicate code ${code} renamed to ${code}-${i + 2}`);
                renamed++;
            }
        }
        // Stored codes were not upper-cased before.
        await collection.updateMany({ code: { $type: 'string', $regex: /[a-z]/ } }, [
            { $set: { code: { $toUpper: '$code' } } },
        ]);

        const indexes = await collection.indexes();
        const legacy = indexes.find((i) => i.name === 'clinicId_1_code_1');
        if (legacy) await collection.dropIndex('clinicId_1_code_1');
        if (!indexes.some((i) => i.name === CODE_INDEX)) {
            await collection.createIndex(
                { clinicId: 1, code: 1 },
                { name: CODE_INDEX, unique: true, partialFilterExpression: { code: { $type: 'string', $gt: '' } } },
            );
        }
        return renamed;
    }

    /** Default catalogue items learn what they do to a tooth (filling → filled), by code. */
    private async backfillToothStatus(): Promise<number> {
        let changed = 0;
        for (const item of DEFAULT_TREATMENTS.filter((t) => t.toothStatus)) {
            const res = await this.treatmentModel.updateMany(
                { code: item.code, isCustom: false, toothStatus: { $exists: false } },
                { $set: { toothStatus: item.toothStatus } },
            );
            changed += res.modifiedCount;
        }
        return changed;
    }

    /**
     * Optional text fields: an empty string means "clear it". Editing used to
     * drop empty fields, so a description or translation could never be removed.
     */
    private toUpdate(dto: UpdateTreatmentDto) {
        const $set: Record<string, unknown> = {};
        const $unset: Record<string, ''> = {};
        for (const [key, value] of Object.entries(dto)) {
            if (value === undefined) continue;
            if (value === '' && key !== 'name') $unset[key] = '';
            else $set[key] = value;
        }
        return { $set, ...(Object.keys($unset).length ? { $unset } : {}) };
    }

    private async assertCodeFree(clinicId: Types.ObjectId, code: string | undefined, exceptId?: Types.ObjectId) {
        if (!code) return;
        const taken = await this.treatmentModel.exists({
            clinicId,
            code,
            ...(exceptId ? { _id: { $ne: exceptId } } : {}),
        });
        if (taken) throw this.codeTaken(code);
    }

    private codeTaken(code?: string) {
        return new ConflictException(
            errorBody('treatmentCodeTaken', `Another treatment already uses code ${code ?? ''}`.trim()),
        );
    }

    /** Runs a write; the unique index still catches a race past `assertCodeFree`. */
    private async guardCode<T>(code: string | undefined, write: () => Promise<T>): Promise<T> {
        try {
            return await write();
        } catch (err) {
            if ((err as { code?: number })?.code === 11000) throw this.codeTaken(code);
            throw err;
        }
    }

    async create(clinicId: Types.ObjectId, dto: CreateTreatmentDto): Promise<TreatmentDocument> {
        const { $set } = this.toUpdate(dto);
        await this.assertCodeFree(clinicId, dto.code);
        return this.guardCode(dto.code, () =>
            this.treatmentModel.create({ ...$set, clinicId, isCustom: dto.isCustom ?? true }),
        );
    }

    /**
     * Treatments for a clinic: search (name in any language, code,
     * description), category, active filter, pagination. Pickers ask for
     * `isActive=true`; the catalogue page shows both.
     */
    async findAll(clinicId: Types.ObjectId, query: QueryTreatmentDto) {
        const { category, search, isActive, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<TreatmentDocument> = { clinicId };

        if (category) {
            filter.category = category;
        }

        if (typeof isActive === 'boolean') {
            filter.isActive = isActive;
        }

        if (search?.trim()) {
            const regex = new RegExp(escapeRegex(search.trim()), 'i');
            filter.$or = [
                { name: regex },
                { nameHy: regex },
                { nameRu: regex },
                { code: regex },
                { description: regex },
            ];
        }

        const [treatments, total] = await Promise.all([
            this.treatmentModel
                .find(filter)
                .sort({ isActive: -1, category: 1, name: 1, _id: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.treatmentModel.countDocuments(filter),
        ]);

        return {
            data: treatments,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find a single treatment by ID, scoped to a clinic.
     */
    async findById(clinicId: Types.ObjectId, treatmentId: Types.ObjectId): Promise<TreatmentDocument> {
        const treatment = await this.treatmentModel.findOne({
            _id: treatmentId,
            clinicId,
        });

        if (!treatment) {
            throw new NotFoundException(errorBody('treatmentNotFound', 'Treatment not found'));
        }

        return treatment;
    }

    /** Only fields present in the DTO change; an empty optional field is cleared. */
    async update(
        clinicId: Types.ObjectId,
        treatmentId: Types.ObjectId,
        dto: UpdateTreatmentDto,
    ): Promise<TreatmentDocument> {
        await this.assertCodeFree(clinicId, dto.code, treatmentId);
        const treatment = await this.guardCode(dto.code, () =>
            this.treatmentModel.findOneAndUpdate({ _id: treatmentId, clinicId }, this.toUpdate(dto), {
                new: true,
                runValidators: true,
            }),
        );

        if (!treatment) {
            throw new NotFoundException(errorBody('treatmentNotFound', 'Treatment not found'));
        }

        return treatment;
    }

    /**
     * Hide a treatment from pickers. Past appointments, chart entries and
     * invoices keep pointing at it, so it is never deleted; `reactivate`
     * brings it back.
     */
    async setActive(clinicId: Types.ObjectId, treatmentId: Types.ObjectId, isActive: boolean): Promise<TreatmentDocument> {
        const treatment = await this.treatmentModel.findOneAndUpdate(
            { _id: treatmentId, clinicId },
            { $set: { isActive } },
            { new: true },
        );

        if (!treatment) {
            throw new NotFoundException(errorBody('treatmentNotFound', 'Treatment not found'));
        }

        return treatment;
    }

    /**
     * Seed default dental treatments for a clinic with an empty catalogue
     * (also done on register).
     */
    async seedDefaultTreatments(clinicId: Types.ObjectId): Promise<{ created: number; message: string }> {
        const existingCount = await this.treatmentModel.countDocuments({ clinicId });

        if (existingCount > 0) {
            return {
                created: 0,
                message: `Clinic already has ${existingCount} treatments. Seeding skipped.`,
            };
        }

        const treatments = DEFAULT_TREATMENTS.map((t) => ({
            ...t,
            clinicId,
            isCustom: false,
            isActive: true,
        }));

        const result = await this.treatmentModel.insertMany(treatments);

        return {
            created: result.length,
            message: `Successfully seeded ${result.length} default treatments.`,
        };
    }
}
