import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlockedTimeDocument = BlockedTime & Document;

export enum BlockedTimeReason {
    BREAK = 'break',
    LUNCH = 'lunch',
    VACATION = 'vacation',
    PERSONAL = 'personal',
    MEETING = 'meeting',
    OTHER = 'other',
}

@Schema({ timestamps: true })
export class BlockedTime {
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
        index: true,
    })
    dentistId: Types.ObjectId;

    @Prop({ required: true })
    startTime: Date;

    @Prop({ required: true })
    endTime: Date;

    @Prop({
        required: true,
        enum: BlockedTimeReason,
    })
    reason: BlockedTimeReason;

    @Prop({ trim: true })
    title: string;

    @Prop({ default: false })
    isRecurring: boolean;
}

export const BlockedTimeSchema = SchemaFactory.createForClass(BlockedTime);

BlockedTimeSchema.index({ clinicId: 1, dentistId: 1, startTime: 1 });
