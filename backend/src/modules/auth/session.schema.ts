import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type SessionDocument = Session & Document;

/**
 * One signed-in device. The refresh token itself is never stored — only its
 * SHA-256 — so a database leak does not hand out working sessions.
 */
@Schema({ timestamps: true, collection: 'auth_sessions' })
export class Session {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    @Prop({ required: true })
    tokenHash: string;

    /**
     * The hash before the last rotation, accepted for a few seconds so two
     * browser tabs refreshing at the same moment don't trip reuse detection.
     */
    @Prop()
    previousTokenHash?: string;

    @Prop()
    rotatedAt?: Date;

    /**
     * The token issued by the last rotation, encrypted with a key derived from
     * the refresh secret. Requests that present the previous token inside the
     * grace window get this same token back, so tabs refreshing at once all
     * end up holding one token instead of forking the session.
     */
    @Prop()
    graceToken?: string;

    @Prop({ trim: true, maxlength: 300 })
    userAgent?: string;

    @Prop({ trim: true })
    ip?: string;

    @Prop({ required: true })
    lastUsedAt: Date;

    @Prop({ required: true })
    expiresAt: Date;

    @Prop()
    revokedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Expired sessions delete themselves. In PROD (autoIndex off) create it by hand:
// db.auth_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
