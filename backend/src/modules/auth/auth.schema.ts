import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from 'src/common/decorators';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop({
        type: Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        required: true,
        enum: Role,
        default: Role.RECEPTIONIST,
    })
    role: Role;

    @Prop({ trim: true })
    firstName: string;

    @Prop({ trim: true })
    lastName: string;

    @Prop({ trim: true })
    patronymic: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    lastLogin: Date;

    @Prop()
    refreshToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
