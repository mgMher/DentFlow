import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Patient, PatientDocument } from './patient.schema';
import { CreatePatientDto, QueryPatientDto, UpdatePatientDto } from './dto';
import { MedicalHistoryDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
    constructor(
        @InjectModel(Patient.name)
        private readonly patientModel: Model<PatientDocument>,
    ) {}

    async create(clinicId: Types.ObjectId, dto: CreatePatientDto): Promise<PatientDocument> {
        const patient = new this.patientModel({
            ...dto,
            clinicId,
        });
        return patient.save();
    }

    async findAll(
        clinicId: Types.ObjectId,
        query: QueryPatientDto,
    ): Promise<{
        data: PatientDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const { page, limit, search, gender, isActive } = query;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<PatientDocument> = { clinicId };

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { phone: searchRegex },
            ];
        }

        if (gender) {
            filter.gender = gender;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive;
        }

        const [data, total] = await Promise.all([
            this.patientModel
                .find(filter)
                .sort({ lastName: 1, firstName: 1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.patientModel.countDocuments(filter).exec(),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(clinicId: Types.ObjectId, patientId: Types.ObjectId): Promise<PatientDocument> {
        const patient = await this.patientModel
            .findOne({ _id: patientId, clinicId })
            .exec();

        if (!patient) {
            throw new NotFoundException(`Patient with ID "${patientId}" not found`);
        }

        return patient;
    }

    async update(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        dto: UpdatePatientDto,
    ): Promise<PatientDocument> {
        const patient = await this.patientModel
            .findOneAndUpdate(
                { _id: patientId, clinicId },
                { $set: dto },
                { new: true, runValidators: true },
            )
            .exec();

        if (!patient) {
            throw new NotFoundException(`Patient with ID "${patientId}" not found`);
        }

        return patient;
    }

    async deactivate(clinicId: Types.ObjectId, patientId: Types.ObjectId): Promise<PatientDocument> {
        const patient = await this.patientModel
            .findOneAndUpdate(
                { _id: patientId, clinicId },
                { $set: { isActive: false } },
                { new: true },
            )
            .exec();

        if (!patient) {
            throw new NotFoundException(`Patient with ID "${patientId}" not found`);
        }

        return patient;
    }

    async updateMedicalHistory(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        medicalHistory: MedicalHistoryDto,
    ): Promise<PatientDocument> {
        const patient = await this.patientModel
            .findOneAndUpdate(
                { _id: patientId, clinicId },
                { $set: { medicalHistory } },
                { new: true, runValidators: true },
            )
            .exec();

        if (!patient) {
            throw new NotFoundException(`Patient with ID "${patientId}" not found`);
        }

        return patient;
    }

    async getPatientStats(
        clinicId: Types.ObjectId,
    ): Promise<{ activePatients: number; newPatientsThisMonth: number }> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [activePatients, newPatientsThisMonth] = await Promise.all([
            this.patientModel.countDocuments({ clinicId, isActive: true }).exec(),
            this.patientModel
                .countDocuments({
                    clinicId,
                    createdAt: { $gte: startOfMonth },
                })
                .exec(),
        ]);

        return { activePatients, newPatientsThisMonth };
    }
}
