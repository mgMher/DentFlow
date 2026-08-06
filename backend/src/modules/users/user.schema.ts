import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from 'src/common/decorators';

export type UserProfileDocument = UserProfile & Document;

@Schema({ _id: false })
export class DayAvailability {
    @Prop({ required: true, min: 0, max: 6 })
    dayOfWeek: number;

    @Prop({ required: true })
    startTime: string;

    @Prop({ required: true })
    endTime: string;
}

export const DayAvailabilitySchema = SchemaFactory.createForClass(DayAvailability);

@Schema({ _id: false })
export class UserSchedule {
    @Prop({ type: [DayAvailabilitySchema], default: [] })
    defaultAvailability: DayAvailability[];
}

export const UserScheduleSchema = SchemaFactory.createForClass(UserSchedule);

@Schema({ timestamps: true, collection: 'user_profiles' })
export class UserProfile {
    @Prop({
        type: Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
    })
    authId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    firstName: string;

    @Prop({ required: true, trim: true })
    lastName: string;

    @Prop({ trim: true })
    patronymic: string;

    @Prop({ required: true, lowercase: true, trim: true })
    email: string;

    @Prop({ trim: true })
    phone: string;

    @Prop({
        required: true,
        enum: Role,
        default: Role.RECEPTIONIST,
    })
    role: Role;

    @Prop({ trim: true })
    specialization: string;

    @Prop({ trim: true })
    licenseNumber: string;

    @Prop({ trim: true })
    avatar: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ type: UserScheduleSchema })
    schedule: UserSchedule;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

// Compound index: unique email per clinic
UserProfileSchema.index({ clinicId: 1, email: 1 }, { unique: true });
