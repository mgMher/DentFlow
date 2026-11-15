import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
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
        type: MongooseSchema.Types.ObjectId,
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

    /** Consecutive wrong passwords; reset on success. */
    @Prop({ default: 0 })
    failedLoginAttempts: number;

    /** Set after too many wrong passwords; login is refused until then. */
    @Prop()
    lockedUntil?: Date;

    // ── F9: password reset by email ──────────────────────────────────────
    /** SHA-256 of the one-time reset token in the emailed link; the token itself is never stored. */
    @Prop({ select: false })
    resetTokenHash?: string;

    @Prop({ select: false })
    resetTokenExpiresAt?: Date;

    // ── F9: two-factor sign-in (authenticator app) ───────────────────────
    /** The authenticator secret, sealed with SECRETS_KEY. */
    @Prop({ select: false })
    twoFactorSecretSealed?: string;

    /** A secret shown during setup, until the first code confirms it. */
    @Prop({ select: false })
    twoFactorPendingSealed?: string;

    @Prop()
    twoFactorEnabledAt?: Date;

    /** The last time step accepted, so each code works once. */
    @Prop({ select: false })
    twoFactorLastStep?: number;

    /** SHA-256 of the unused backup codes. */
    @Prop({ type: [String], select: false, default: undefined })
    backupCodeHashes?: string[];

    /** Devices that may skip the code for 30 days: SHA-256 of their token. */
    @Prop({
        type: [{ tokenHash: String, expiresAt: Date, createdAt: Date, userAgent: String, _id: false }],
        select: false,
        default: undefined,
    })
    trustedDevices?: { tokenHash: string; expiresAt: Date; createdAt: Date; userAgent?: string }[];
}

export const UserSchema = SchemaFactory.createForClass(User);
