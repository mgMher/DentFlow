import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    NotificationTemplate,
    NotificationTemplateDocument,
} from './notification-template.schema';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';

@Injectable()
export class SettingsService {
    constructor(
        @InjectModel(NotificationTemplate.name)
        private readonly templateModel: Model<NotificationTemplateDocument>,
    ) {}

    async getTemplates(clinicId: string): Promise<NotificationTemplateDocument[]> {
        return this.templateModel
            .find({ clinicId: new Types.ObjectId(clinicId) })
            .sort({ type: 1, channel: 1, language: 1 })
            .exec();
    }

    async createTemplate(
        clinicId: string,
        dto: CreateTemplateDto,
    ): Promise<NotificationTemplateDocument> {
        const template = new this.templateModel({
            clinicId: new Types.ObjectId(clinicId),
            type: dto.type,
            channel: dto.channel,
            subject: dto.subject,
            bodyTemplate: dto.bodyTemplate,
            isActive: dto.isActive !== undefined ? dto.isActive : true,
            language: dto.language,
        });

        return template.save();
    }

    async updateTemplate(
        clinicId: string,
        templateId: string,
        dto: UpdateTemplateDto,
    ): Promise<NotificationTemplateDocument> {
        const template = await this.templateModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(templateId),
                    clinicId: new Types.ObjectId(clinicId),
                },
                { $set: dto },
                { new: true, runValidators: true },
            )
            .exec();

        if (!template) {
            throw new NotFoundException(`Template with ID "${templateId}" not found`);
        }

        return template;
    }

    async deleteTemplate(clinicId: string, templateId: string): Promise<void> {
        const result = await this.templateModel
            .findOneAndDelete({
                _id: new Types.ObjectId(templateId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .exec();

        if (!result) {
            throw new NotFoundException(`Template with ID "${templateId}" not found`);
        }
    }
}
