import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClinicDocument = Clinic & Document;

export enum SubscriptionStatus {
    ACTIVE = 'active',
    TRIAL = 'trial',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}

export enum SupportedLanguage {
    HY = 'hy',
    RU = 'ru',
    EN = 'en',
}

export enum SupportedCurrency {
    AMD = 'AMD',
    USD = 'USD',
    RUB = 'RUB',
}

@Schema({ _id: false })
export class Address {
    @Prop({ trim: true })
    street: string;

    @Prop({ trim: true })
    city: string;

    @Prop({ trim: true })
    state: string;

    @Prop({ trim: true })
    zipCode: string;

    @Prop({ trim: true })
    country: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ _id: false })
export class WorkingHour {
    @Prop({ required: true, min: 0, max: 6 })
    dayOfWeek: number;

    @Prop({ required: true })
    startTime: string;

    @Prop({ required: true })
    endTime: string;

    @Prop({ default: true })
    isOpen: boolean;
}

export const WorkingHourSchema = SchemaFactory.createForClass(WorkingHour);

@Schema({ _id: false })
export class Subscription {
    @Prop({ trim: true })
    plan: string;

    @Prop({
        enum: SubscriptionStatus,
        default: SubscriptionStatus.TRIAL,
    })
    status: SubscriptionStatus;

    @Prop()
    expiresAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

@Schema({ timestamps: true })
export class Clinic {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ type: AddressSchema })
    address: Address;

    @Prop({ trim: true })
    phone: string;

    @Prop({ trim: true, lowercase: true })
    email: string;

    @Prop({ trim: true })
    logo: string;

    @Prop({ type: [WorkingHourSchema], default: [] })
    workingHours: WorkingHour[];

    @Prop({ default: 'Asia/Yerevan' })
    timezone: string;

    @Prop({
        enum: SupportedLanguage,
        default: SupportedLanguage.HY,
    })
    language: SupportedLanguage;

    @Prop({
        enum: SupportedCurrency,
        default: SupportedCurrency.AMD,
    })
    currency: SupportedCurrency;

    @Prop({ type: SubscriptionSchema })
    subscription: Subscription;

    @Prop({ default: true })
    isActive: boolean;
}

export const ClinicSchema = SchemaFactory.createForClass(Clinic);
