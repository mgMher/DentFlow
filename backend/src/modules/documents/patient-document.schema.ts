import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type PatientDocumentDocument = PatientDocument & Document;

export enum DocumentKind {
    XRAY = 'xray',
    PHOTO = 'photo',
    CONSENT = 'consent',
    REFERRAL = 'referral',
    LAB = 'lab',
    OTHER = 'other',
}

@Schema({ _id: false })
export class StoredFile {
    /** Storage key (see FileStorageService); never sent to the client. */
    @Prop({ required: true })
    key: string;

    @Prop({ required: true, trim: true, maxlength: 255 })
    originalName: string;

    /** Detected from the file's bytes, not taken from the upload. */
    @Prop({ required: true })
    mimeType: string;

    @Prop({ required: true })
    size: number;

    @Prop({ required: true })
    sha256: string;
}

export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);

/**
 * An X-ray, photo, consent form, referral or lab result for a patient,
 * optionally tied to teeth (F6). Files are kept when a document is removed:
 * removal hides it, with who, when and why.
 */
@Schema({ timestamps: true, collection: 'patient_documents' })
export class PatientDocument {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Patient', required: true })
    patientId: Types.ObjectId;

    @Prop({ required: true, enum: DocumentKind })
    kind: DocumentKind;

    @Prop({ required: true, trim: true, maxlength: 200 })
    title: string;

    /** FDI tooth numbers this is about; empty for the whole mouth or no tooth. */
    @Prop({ type: [Number], default: [] })
    teeth: number[];

    /** When the X-ray / photo was taken or the document signed. */
    @Prop({ required: true })
    takenAt: Date;

    @Prop({ trim: true, maxlength: 2000 })
    notes: string;

    @Prop({ type: StoredFileSchema, required: true })
    file: StoredFile;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    uploadedBy: Types.ObjectId;

    @Prop()
    deletedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    deletedBy: Types.ObjectId;

    @Prop({ trim: true })
    deleteReason: string;
}

export const PatientDocumentSchema = SchemaFactory.createForClass(PatientDocument);

PatientDocumentSchema.index({ clinicId: 1, patientId: 1, takenAt: -1 });
PatientDocumentSchema.index({ clinicId: 1, patientId: 1, teeth: 1 });
