import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    StreamableFile,
    UploadedFile as UploadedFileParam,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { DocumentsService, UploadedFile } from './documents.service';
import { maxUploadBytes } from './file-types';
import { QueryDocumentsDto, RemoveDocumentDto, UpdateDocumentDto, UploadDocumentDto } from './dto/documents.dto';

/** Removing a document from the record is a clinical decision. */
const REMOVERS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST];
type AuthUser = { userId: string; clinicId: string; role: Role };
const oid = (id: string) => new Types.ObjectId(id);

/** F6: X-rays, photos and papers. Every staff member may view and upload (assistants often take the X-rays). */
@ApiTags('Documents')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
    constructor(private readonly documents: DocumentsService) {}

    @Post('patients/:patientId/documents')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload an X-ray, photo or document (JPEG, PNG, WebP, PDF, DICOM)' })
    // A byte over the limit is enough for multer to refuse it; the service gives the friendly error.
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes() + 1, files: 1 } }))
    upload(
        @CurrentUser() user: AuthUser,
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @UploadedFileParam() file: UploadedFile | undefined,
        @Body() dto: UploadDocumentDto,
    ) {
        return this.documents.upload(oid(user.clinicId), patientId, oid(user.userId), file, dto);
    }

    @Get('patients/:patientId/documents')
    @ApiOperation({ summary: "A patient's documents, newest first (filter by kind or tooth)" })
    list(
        @CurrentUser('clinicId') clinicId: string,
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Query() query: QueryDocumentsDto,
    ) {
        return this.documents.list(oid(clinicId), patientId, query);
    }

    @Get('documents/:id')
    @ApiOperation({ summary: 'One document (details, not the file)' })
    findOne(@CurrentUser('clinicId') clinicId: string, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.documents.findOne(oid(clinicId), id);
    }

    @Get('documents/:id/file')
    @ApiOperation({ summary: 'The file itself; only through the API, never a public link' })
    async file(@CurrentUser('clinicId') clinicId: string, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        const f = await this.documents.file(oid(clinicId), id);
        return new StreamableFile(f.stream, {
            type: f.mimeType,
            length: f.size,
            disposition: `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        });
    }

    @Patch('documents/:id')
    @ApiOperation({ summary: 'Change kind, title, teeth, date or notes (uploader or a dentist)' })
    update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdateDocumentDto) {
        return this.documents.update(oid(user.clinicId), id, { userId: oid(user.userId), role: user.role }, dto);
    }

    @Delete('documents/:id')
    @Roles(...REMOVERS)
    @ApiOperation({ summary: 'Remove from the record (kept, with the reason)' })
    remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: RemoveDocumentDto) {
        return this.documents.remove(oid(user.clinicId), id, oid(user.userId), dto);
    }
}
