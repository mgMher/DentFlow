import { BadRequestException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { errorBody } from 'src/common/utils';
import { isFdiTooth } from '../dental-records/tooth-numbering';
import { PatientDocument, PatientDocumentDocument } from './patient-document.schema';
import { FileStorageService } from './file-storage.service';
import { detectFileType, maxUploadBytes } from './file-types';
import { QueryDocumentsDto, RemoveDocumentDto, UpdateDocumentDto, UploadDocumentDto } from './dto/documents.dto';

type Id = Types.ObjectId;
const PERSON = 'firstName lastName';
/** Clinicians may correct anyone's documents; others only their own uploads. */
const CLINICAL = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST];

/** What multer hands over (memory storage). */
export interface UploadedFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

/** X-rays, photos and papers per patient and per tooth (F6). */
@Injectable()
export class DocumentsService {
    constructor(
        @InjectModel(PatientDocument.name) private readonly documentModel: Model<PatientDocumentDocument>,
        private readonly storage: FileStorageService,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    async upload(clinicId: Id, patientId: Id, userId: Id, file: UploadedFile | undefined, dto: UploadDocumentDto) {
        if (!file?.buffer?.length) throw new BadRequestException(errorBody('fileRequired', 'Choose a file to upload'));
        if (file.size > maxUploadBytes()) throw new PayloadTooLargeException(errorBody('fileTooLarge', 'The file is too large'));
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const data = new Uint8Array(file.buffer);
        const type = detectFileType(data);
        if (!type) {
            throw new BadRequestException(errorBody('unsupportedFileType', 'Only JPEG, PNG, WebP, PDF and DICOM files can be uploaded'));
        }
        const teeth = this.teeth(dto.teeth);

        const key = await this.storage.put(clinicId.toString(), data);
        try {
            const doc = await this.documentModel.create({
                clinicId,
                patientId,
                kind: dto.kind,
                title: dto.title?.trim() || this.cleanName(file.originalname),
                teeth,
                takenAt: dto.takenAt ? new Date(dto.takenAt) : new Date(),
                notes: dto.notes,
                file: {
                    key,
                    originalName: this.cleanName(file.originalname),
                    mimeType: type.mimeType,
                    size: data.length,
                    sha256: createHash('sha256').update(data).digest('hex'),
                },
                uploadedBy: userId,
            });
            return this.findOne(clinicId, doc._id);
        } catch (err) {
            await this.storage.remove(key);
            throw err;
        }
    }

    async list(clinicId: Id, patientId: Id, query: QueryDocumentsDto) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const docs = await this.documentModel
            .find({
                clinicId,
                patientId,
                deletedAt: null,
                ...(query.kind ? { kind: query.kind } : {}),
                ...(query.tooth !== undefined ? { teeth: query.tooth } : {}),
            })
            .sort({ takenAt: -1, _id: -1 })
            .limit(500)
            .populate({ path: 'uploadedBy', select: PERSON })
            .lean();
        return docs.map((d) => this.present(d));
    }

    async findOne(clinicId: Id, documentId: Id) {
        const doc = await this.documentModel
            .findOne({ _id: documentId, clinicId, deletedAt: null })
            .populate({ path: 'uploadedBy', select: PERSON })
            .lean();
        if (!doc) throw this.notFound();
        return this.present(doc);
    }

    async update(clinicId: Id, documentId: Id, user: { userId: Id; role: Role }, dto: UpdateDocumentDto) {
        const doc = await this.documentModel.findOne({ _id: documentId, clinicId, deletedAt: null }).select('uploadedBy').lean();
        if (!doc) throw this.notFound();
        if (!CLINICAL.includes(user.role) && !doc.uploadedBy.equals(user.userId)) {
            throw new ForbiddenException(errorBody('documentEditForbidden', 'Only the person who uploaded it or a dentist can change it'));
        }
        const $set: Record<string, unknown> = {};
        if (dto.kind) $set.kind = dto.kind;
        if (dto.title) $set.title = dto.title;
        if (dto.teeth) $set.teeth = this.teeth(dto.teeth);
        if (dto.takenAt) $set.takenAt = new Date(dto.takenAt);
        if (dto.notes !== undefined) $set.notes = dto.notes;
        await this.documentModel.updateOne({ _id: documentId, clinicId, deletedAt: null }, { $set });
        return this.findOne(clinicId, documentId);
    }

    /** Hidden with who, when and why; the file stays (it is part of the medical record). */
    async remove(clinicId: Id, documentId: Id, userId: Id, dto: RemoveDocumentDto) {
        const removed = await this.documentModel.updateOne(
            { _id: documentId, clinicId, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: userId, deleteReason: dto.reason } },
        );
        if (!removed.matchedCount) throw this.notFound();
        return { removed: true };
    }

    async file(clinicId: Id, documentId: Id) {
        const doc = await this.documentModel.findOne({ _id: documentId, clinicId, deletedAt: null }).select('file').lean();
        if (!doc) throw this.notFound();
        const { stream, size } = await this.storage.open(doc.file.key).catch(() => {
            throw new NotFoundException(errorBody('documentFileMissing', 'The file is missing from storage'));
        });
        return { stream, size, mimeType: doc.file.mimeType, name: doc.file.originalName };
    }

    private present(doc: PatientDocument & { _id: Id }) {
        const { key, ...file } = doc.file;
        void key;
        return { ...doc, file: { ...file, viewable: file.mimeType !== 'application/dicom' } };
    }

    private teeth(teeth: number[] = []) {
        const invalid = teeth.filter((n) => !isFdiTooth(n));
        if (invalid.length) throw new BadRequestException(errorBody('invalidTooth', `Not FDI tooth numbers: ${invalid.join(', ')}`));
        return [...new Set(teeth)].sort((a, b) => a - b);
    }

    /** A file name safe to show and to send back in a header. */
    private cleanName(name: string) {
        const base = (name || 'file').split(/[\\/]/).pop()!.replace(/[\u0000-\u001f"]/g, '').trim();
        return (base || 'file').slice(0, 200);
    }

    private notFound() {
        return new NotFoundException(errorBody('documentNotFound', 'Document not found'));
    }
}
