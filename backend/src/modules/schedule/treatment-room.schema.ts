import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TreatmentRoomDocument = TreatmentRoom & Document;

@Schema({ timestamps: true })
export class TreatmentRoom {
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
    description: string;

    @Prop({ type: [String], default: [] })
    equipment: string[];

    @Prop({ default: true })
    isActive: boolean;
}

export const TreatmentRoomSchema = SchemaFactory.createForClass(TreatmentRoom);

TreatmentRoomSchema.index({ clinicId: 1, name: 1 });
