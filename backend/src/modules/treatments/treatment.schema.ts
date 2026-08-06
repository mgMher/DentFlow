import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TreatmentCategory {
    GENERAL = 'general',
    SURGICAL = 'surgical',
    COSMETIC = 'cosmetic',
    ORTHODONTIC = 'orthodontic',
    ENDODONTIC = 'endodontic',
    PERIODONTIC = 'periodontic',
    PROSTHODONTIC = 'prosthodontic',
    PEDIATRIC = 'pediatric',
    DIAGNOSTIC = 'diagnostic',
    PREVENTIVE = 'preventive',
}

export enum Currency {
    AMD = 'AMD',
    USD = 'USD',
    RUB = 'RUB',
}

@Schema({ _id: false })
export class TreatmentPrice {
    @Prop({ required: true, min: 0 })
    amount: number;

    @Prop({ required: true, enum: Currency, default: Currency.AMD })
    currency: Currency;
}

export const TreatmentPriceSchema = SchemaFactory.createForClass(TreatmentPrice);

export type TreatmentDocument = Treatment & Document;

@Schema({ timestamps: true })
export class Treatment {
    @Prop({
        type: Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ trim: true })
    nameHy: string;

    @Prop({ trim: true })
    nameRu: string;

    @Prop({
        required: true,
        enum: TreatmentCategory,
    })
    category: TreatmentCategory;

    @Prop({ trim: true })
    description: string;

    @Prop({ trim: true })
    code: string;

    @Prop({ default: 30, min: 5 })
    duration: number;

    @Prop({ type: TreatmentPriceSchema, default: () => ({ amount: 0, currency: Currency.AMD }) })
    price: TreatmentPrice;

    @Prop({ default: false })
    isCustom: boolean;

    @Prop({ default: true })
    isActive: boolean;
}

export const TreatmentSchema = SchemaFactory.createForClass(Treatment);

TreatmentSchema.index({ clinicId: 1, name: 1 });
TreatmentSchema.index({ clinicId: 1, category: 1 });
TreatmentSchema.index({ clinicId: 1, code: 1 });
TreatmentSchema.index({ clinicId: 1, isActive: 1 });
