import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clinic, ClinicDocument } from './clinic.schema';
import { UpdateClinicDto, UpdateWorkingHoursDto, UpdateSettingsDto } from './dto';

@Injectable()
export class ClinicsService {
    constructor(
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    ) {}

    /**
     * Retrieve a clinic by its ID.
     * The clinicId IS the document _id for clinics.
     */
    async getClinic(clinicId: string): Promise<ClinicDocument> {
        const clinic = await this.clinicModel.findById(clinicId).lean();

        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        return clinic as ClinicDocument;
    }

    /**
     * Update a clinic's general information.
     * Only the fields provided in the DTO are updated.
     */
    async updateClinic(clinicId: string, dto: UpdateClinicDto): Promise<ClinicDocument> {
        const updatePayload: Record<string, any> = {};

        // Handle top-level fields
        if (dto.name !== undefined) updatePayload.name = dto.name;
        if (dto.phone !== undefined) updatePayload.phone = dto.phone;
        if (dto.email !== undefined) updatePayload.email = dto.email;
        if (dto.logo !== undefined) updatePayload.logo = dto.logo;
        if (dto.timezone !== undefined) updatePayload.timezone = dto.timezone;
        if (dto.language !== undefined) updatePayload.language = dto.language;
        if (dto.currency !== undefined) updatePayload.currency = dto.currency;
        if (dto.workingHours !== undefined) updatePayload.workingHours = dto.workingHours;

        // Handle nested address with dot notation to allow partial updates
        if (dto.address) {
            if (dto.address.street !== undefined) updatePayload['address.street'] = dto.address.street;
            if (dto.address.city !== undefined) updatePayload['address.city'] = dto.address.city;
            if (dto.address.state !== undefined) updatePayload['address.state'] = dto.address.state;
            if (dto.address.zipCode !== undefined) updatePayload['address.zipCode'] = dto.address.zipCode;
            if (dto.address.country !== undefined) updatePayload['address.country'] = dto.address.country;
        }

        // Handle nested subscription with dot notation
        if (dto.subscription) {
            if (dto.subscription.plan !== undefined) updatePayload['subscription.plan'] = dto.subscription.plan;
            if (dto.subscription.status !== undefined) updatePayload['subscription.status'] = dto.subscription.status;
            if (dto.subscription.expiresAt !== undefined) updatePayload['subscription.expiresAt'] = new Date(dto.subscription.expiresAt);
        }

        const clinic = await this.clinicModel
            .findByIdAndUpdate(clinicId, { $set: updatePayload }, { new: true, runValidators: true })
            .lean();

        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        return clinic as ClinicDocument;
    }

    /**
     * Replace the entire workingHours array for a clinic.
     */
    async updateWorkingHours(clinicId: string, dto: UpdateWorkingHoursDto): Promise<ClinicDocument> {
        const clinic = await this.clinicModel
            .findByIdAndUpdate(
                clinicId,
                { $set: { workingHours: dto.workingHours } },
                { new: true, runValidators: true },
            )
            .lean();

        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        return clinic as ClinicDocument;
    }

    /**
     * Update clinic settings: language, currency, and timezone.
     * Only the provided fields are updated.
     */
    async updateSettings(
        clinicId: string,
        settings: UpdateSettingsDto,
    ): Promise<ClinicDocument> {
        const updatePayload: Record<string, any> = {};

        if (settings.language !== undefined) updatePayload.language = settings.language;
        if (settings.currency !== undefined) updatePayload.currency = settings.currency;
        if (settings.timezone !== undefined) updatePayload.timezone = settings.timezone;

        const clinic = await this.clinicModel
            .findByIdAndUpdate(clinicId, { $set: updatePayload }, { new: true, runValidators: true })
            .lean();

        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        return clinic as ClinicDocument;
    }
}
