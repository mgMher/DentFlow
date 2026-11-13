import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { ageOn, errorBody, isMinor, toClinicDateString } from 'src/common/utils';
import { Guardian, Patient, PatientDocument, PatientStatus } from './patient.schema';
import { AddGuardianDto, UpdateGuardianDto } from './dto/family.dto';

type Id = Types.ObjectId;
const SUMMARY = 'firstName lastName patronymic phone dateOfBirth status telegramChatId';
export const MAX_GUARDIANS = 4;

type Summary = Pick<Patient, 'firstName' | 'lastName' | 'patronymic' | 'phone' | 'dateOfBirth' | 'status'> & {
    _id: Id;
    telegramChatId?: string;
};

/**
 * Parents and guardians (F8). Links are stored on the child only
 * (`guardians`); a guardian's children and a child's siblings are found from
 * them, so the two sides can never disagree.
 */
@Injectable()
export class FamilyService {
    constructor(
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    /** Guardians, children and siblings of one patient, with whether they are a minor today. */
    async family(clinicId: Id, patientId: Id) {
        const patient = await this.patientModel.findOne({ _id: patientId, clinicId }).select('dateOfBirth guardians').lean();
        if (!patient) throw this.patientNotFound();
        const today = toClinicDateString(new Date(), await this.clinicRefs.timezoneOf(clinicId));

        const linkedIds = (patient.guardians ?? []).filter((g) => g.patientId).map((g) => g.patientId!);
        const [linked, children, siblings] = await Promise.all([
            this.patientModel.find({ _id: { $in: linkedIds }, clinicId }).select(SUMMARY).lean<Summary[]>(),
            this.patientModel.find({ clinicId, 'guardians.patientId': patientId }).select(`${SUMMARY} guardians`).lean(),
            linkedIds.length
                ? this.patientModel
                      .find({ clinicId, _id: { $ne: patientId }, 'guardians.patientId': { $in: linkedIds } })
                      .select(SUMMARY)
                      .lean<Summary[]>()
                : Promise.resolve([] as Summary[]),
        ]);

        const person = (p: Summary) => ({
            _id: p._id,
            firstName: p.firstName,
            lastName: p.lastName,
            patronymic: p.patronymic,
            phone: p.phone,
            dateOfBirth: p.dateOfBirth,
            status: p.status,
            age: p.dateOfBirth ? ageOn(p.dateOfBirth, today) : null,
            telegram: !!p.telegramChatId,
        });

        return {
            age: patient.dateOfBirth ? ageOn(patient.dateOfBirth, today) : null,
            minor: isMinor(patient.dateOfBirth, today),
            guardians: (patient.guardians ?? []).map((g) => {
                const p = g.patientId ? linked.find((l) => l._id.equals(g.patientId!)) : undefined;
                return {
                    _id: g._id,
                    relationship: g.relationship,
                    isPrimary: g.isPrimary,
                    name: g.name,
                    phone: g.phone,
                    patient: p ? person(p) : g.patientId ? null : undefined,
                };
            }),
            children: children.map((c) => {
                const link = (c.guardians ?? []).find((g) => g.patientId?.equals(patientId));
                return { ...person(c as Summary), relationship: link?.relationship, isPrimary: !!link?.isPrimary };
            }),
            siblings: siblings.map(person),
        };
    }

    async addGuardian(clinicId: Id, patientId: Id, dto: AddGuardianDto) {
        const patient = await this.load(clinicId, patientId);
        if (patient.guardians.length >= MAX_GUARDIANS) {
            throw new BadRequestException(errorBody('tooManyGuardians', `A patient can have at most ${MAX_GUARDIANS} guardians`));
        }

        const guardian: Partial<Guardian> = { relationship: dto.relationship };
        if (dto.patientId) {
            const guardianId = new Types.ObjectId(dto.patientId);
            if (guardianId.equals(patientId)) {
                throw new BadRequestException(errorBody('guardianIsSelf', 'A patient cannot be their own guardian'));
            }
            await this.clinicRefs.assertPatient(clinicId, guardianId);
            if (patient.guardians.some((g) => g.patientId?.equals(guardianId))) {
                throw new ConflictException(errorBody('guardianAlreadyLinked', 'This person is already a guardian of the patient'));
            }
            // A child cannot become their own parent's guardian.
            const reverse = await this.patientModel.exists({ _id: guardianId, clinicId, 'guardians.patientId': patientId });
            if (reverse) {
                throw new BadRequestException(errorBody('guardianCycle', "The patient is already this person's guardian"));
            }
            guardian.patientId = guardianId;
        } else {
            guardian.name = dto.name;
            guardian.phone = dto.phone;
        }

        // The first guardian is the main one; a new main one replaces the old.
        const primary = dto.isPrimary || !patient.guardians.some((g) => g.isPrimary);
        if (primary) patient.guardians.forEach((g) => (g.isPrimary = false));
        patient.guardians.push({ ...guardian, isPrimary: primary } as Guardian);
        await patient.save();
        return this.family(clinicId, patientId);
    }

    async updateGuardian(clinicId: Id, patientId: Id, guardianId: Id, dto: UpdateGuardianDto) {
        const patient = await this.load(clinicId, patientId);
        const guardian = this.find(patient, guardianId);
        if ((dto.name !== undefined || dto.phone !== undefined) && guardian.patientId) {
            throw new BadRequestException(
                errorBody('guardianIsPatient', "This guardian is a patient: change their name and phone on their own record"),
            );
        }
        if (dto.relationship) guardian.relationship = dto.relationship;
        if (dto.name !== undefined) guardian.name = dto.name;
        if (dto.phone !== undefined) guardian.phone = dto.phone;
        if (dto.isPrimary) patient.guardians.forEach((g) => (g.isPrimary = g._id.equals(guardianId)));
        await patient.save();
        return this.family(clinicId, patientId);
    }

    async removeGuardian(clinicId: Id, patientId: Id, guardianId: Id) {
        const patient = await this.load(clinicId, patientId);
        const guardian = this.find(patient, guardianId);
        patient.guardians = patient.guardians.filter((g) => !g._id.equals(guardianId));
        // Someone stays the main guardian while there are any.
        if (guardian.isPrimary && patient.guardians.length) patient.guardians[0].isPrimary = true;
        await patient.save();
        return this.family(clinicId, patientId);
    }

    /**
     * Who gets messages meant for this patient: while they are under 18, their
     * main guardian (a linked patient's phone / Telegram, or the contact's
     * phone); otherwise — or with no usable guardian — the patient themself.
     */
    async recipientFor(
        clinicId: Id,
        patient: { _id: Id; dateOfBirth?: Date; guardians?: Guardian[] },
        timezone: string,
    ): Promise<{ patientId?: Id; phone?: string; telegramChatId?: string; guardian?: { name: string; relationship: string } } | null> {
        if (!isMinor(patient.dateOfBirth, toClinicDateString(new Date(), timezone))) return null;
        const main = (patient.guardians ?? []).find((g) => g.isPrimary) ?? patient.guardians?.[0];
        if (!main) return null;
        if (!main.patientId) {
            return main.phone ? { phone: main.phone, guardian: { name: main.name ?? '', relationship: main.relationship } } : null;
        }
        const g = await this.patientModel
            .findOne({ _id: main.patientId, clinicId, status: { $ne: PatientStatus.DECEASED } })
            .select('firstName lastName phone telegramChatId')
            .lean();
        if (!g) return null;
        return {
            patientId: g._id,
            phone: g.phone,
            telegramChatId: g.telegramChatId,
            guardian: { name: [g.firstName, g.lastName].filter(Boolean).join(' '), relationship: main.relationship },
        };
    }

    /** The patients this one is a guardian of. */
    async childrenOf(clinicId: Id, patientId: Id): Promise<Id[]> {
        const rows = await this.patientModel.find({ clinicId, 'guardians.patientId': patientId }).select('_id').lean();
        return rows.map((r) => r._id);
    }

    private async load(clinicId: Id, patientId: Id) {
        const patient = await this.patientModel.findOne({ _id: patientId, clinicId }).select('guardians');
        if (!patient) throw this.patientNotFound();
        return patient;
    }

    private find(patient: PatientDocument, guardianId: Id) {
        const guardian = patient.guardians.find((g) => g._id.equals(guardianId));
        if (!guardian) throw new NotFoundException(errorBody('guardianNotFound', 'Guardian not found'));
        return guardian;
    }

    private patientNotFound() {
        return new NotFoundException(errorBody('patientNotFound', 'Patient not found'));
    }
}
