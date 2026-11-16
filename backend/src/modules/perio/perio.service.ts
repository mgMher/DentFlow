import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { errorBody, toClinicDateString } from 'src/common/utils';
import { DentalRecord, DentalRecordDocument, ToothStatus } from '../dental-records/dental-record.schema';
import { ADULT_TEETH } from '../dental-records/tooth-numbering';
import { PerioExam, PerioExamDocument, PerioTooth, PERIO_SITES } from './perio-exam.schema';
import { summarizePerio } from './perio-summary';
import { CreatePerioExamDto, PerioToothDto, RemovePerioExamDto, UpdatePerioExamDto } from './dto/perio.dto';

type Id = Types.ObjectId;
const PERSON = 'firstName lastName';
const emptySites = () => PERIO_SITES.map(() => ({ pd: null, rec: null, bop: false, sup: false, plaque: false }));

/** F12: periodontal exams — six sites a tooth, kept by date to compare. */
@Injectable()
export class PerioService {
    constructor(
        @InjectModel(PerioExam.name) private readonly examModel: Model<PerioExamDocument>,
        @InjectModel(DentalRecord.name) private readonly chartModel: Model<DentalRecordDocument>,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    /** The patient's exams, newest first, each with its figures. */
    async list(clinicId: Id, patientId: Id) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const exams = await this.examModel
            .find({ clinicId, patientId, deletedAt: null })
            .sort({ date: -1, createdAt: -1 })
            .populate('dentistId', PERSON)
            .lean();
        return exams.map(({ teeth, ...e }) => ({ ...e, summary: summarizePerio(teeth) }));
    }

    /**
     * A new, empty exam over the teeth on the patient's chart, with missing
     * teeth and implants already marked from it.
     */
    async create(clinicId: Id, patientId: Id, user: { userId: Id; isDentist: boolean }, dto: CreatePerioExamDto) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const date = await this.checkDate(clinicId, dto.date);
        const dentistId = await this.dentist(clinicId, dto.dentistId, user);

        const chart = await this.chartModel.findOne({ clinicId, patientId }).select('teeth.toothNumber teeth.status').lean();
        const status = new Map((chart?.teeth ?? []).map((t) => [t.toothNumber, t.status]));
        const numbers = chart?.teeth?.length ? chart.teeth.map((t) => t.toothNumber) : [...ADULT_TEETH];
        const teeth = numbers.map((toothNumber) => ({
            toothNumber,
            missing: status.get(toothNumber) === ToothStatus.MISSING,
            implant: status.get(toothNumber) === ToothStatus.IMPLANT,
            mobility: null,
            furcation: null,
            sites: emptySites(),
        }));

        const exam = await this.examModel.create({
            clinicId,
            patientId,
            date,
            dentistId,
            recordedBy: user.userId,
            lastUpdatedBy: user.userId,
            teeth,
            notes: dto.notes,
        });
        return this.findOne(clinicId, exam._id);
    }

    /** One exam with its figures, and the one before it to compare with. */
    async findOne(clinicId: Id, id: Id) {
        const exam = await this.examModel
            .findOne({ _id: id, clinicId, deletedAt: null })
            .populate('dentistId', PERSON)
            .populate('recordedBy', PERSON)
            .lean();
        if (!exam) throw new NotFoundException(errorBody('perioExamNotFound', 'Periodontal exam not found'));
        const previous = await this.examModel
            .findOne({
                clinicId,
                patientId: exam.patientId,
                deletedAt: null,
                _id: { $ne: exam._id },
                $or: [{ date: { $lt: exam.date } }, { date: exam.date, createdAt: { $lt: (exam as any).createdAt } }],
            })
            .sort({ date: -1, createdAt: -1 })
            .select('date teeth')
            .lean();
        return {
            ...exam,
            summary: summarizePerio(exam.teeth),
            previous: previous ? { ...previous, summary: summarizePerio(previous.teeth) } : null,
        };
    }

    /** One tooth, saved whole (the screen saves each tooth as you leave it). */
    async saveTooth(clinicId: Id, id: Id, toothNumber: number, userId: Id, dto: PerioToothDto) {
        const tooth: PerioTooth = {
            toothNumber,
            missing: !!dto.missing,
            implant: !!dto.implant,
            mobility: dto.mobility ?? null,
            furcation: dto.furcation ?? null,
            sites: (dto.sites ?? emptySites()).map((s) => ({
                pd: s.pd ?? null,
                rec: s.rec ?? null,
                bop: !!s.bop,
                sup: !!s.sup,
                plaque: !!s.plaque,
            })),
        };
        const exam = await this.examModel
            .findOneAndUpdate(
                { _id: id, clinicId, deletedAt: null, 'teeth.toothNumber': toothNumber },
                { $set: { 'teeth.$': tooth, lastUpdatedBy: userId } },
                { new: true, runValidators: true },
            )
            .select('teeth')
            .lean();
        if (!exam) {
            if (!(await this.examModel.exists({ _id: id, clinicId, deletedAt: null }))) {
                throw new NotFoundException(errorBody('perioExamNotFound', 'Periodontal exam not found'));
            }
            throw new NotFoundException(errorBody('toothNotInExam', `Tooth ${toothNumber} is not in this exam`));
        }
        return { tooth: exam.teeth.find((t) => t.toothNumber === toothNumber), summary: summarizePerio(exam.teeth) };
    }

    async update(clinicId: Id, id: Id, userId: Id, dto: UpdatePerioExamDto) {
        const set: Record<string, unknown> = { lastUpdatedBy: userId };
        if (dto.date !== undefined) set.date = await this.checkDate(clinicId, dto.date);
        if (dto.dentistId !== undefined) {
            if (dto.dentistId !== null) await this.clinicRefs.assertDentist(clinicId, new Types.ObjectId(dto.dentistId));
            set.dentistId = dto.dentistId ? new Types.ObjectId(dto.dentistId) : null;
        }
        if (dto.notes !== undefined) set.notes = dto.notes;
        const res = await this.examModel.updateOne({ _id: id, clinicId, deletedAt: null }, { $set: set });
        if (!res.matchedCount) throw new NotFoundException(errorBody('perioExamNotFound', 'Periodontal exam not found'));
        return this.findOne(clinicId, id);
    }

    /** Hidden from the record, kept with who, when and why. */
    async remove(clinicId: Id, id: Id, userId: Id, dto: RemovePerioExamDto) {
        const res = await this.examModel.updateOne(
            { _id: id, clinicId, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: userId, deleteReason: dto.reason } },
        );
        if (!res.matchedCount) throw new NotFoundException(errorBody('perioExamNotFound', 'Periodontal exam not found'));
        return { removed: true };
    }

    private async checkDate(clinicId: Id, date?: string) {
        const today = toClinicDateString(new Date(), await this.clinicRefs.timezoneOf(clinicId));
        if (!date) return today;
        if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new BadRequestException(errorBody('invalidDate', 'Not a valid date'));
        if (date > today) throw new BadRequestException(errorBody('perioExamInFuture', 'An exam cannot be dated in the future'));
        return date;
    }

    /** The named dentist, else the dentist recording it; others may leave it empty. */
    private async dentist(clinicId: Id, dentistId: string | undefined, user: { userId: Id; isDentist: boolean }) {
        if (dentistId) {
            const id = new Types.ObjectId(dentistId);
            await this.clinicRefs.assertDentist(clinicId, id);
            return id;
        }
        return user.isDentist ? user.userId : null;
    }
}
