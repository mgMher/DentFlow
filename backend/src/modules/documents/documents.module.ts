import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PatientDocument, PatientDocumentSchema } from './patient-document.schema';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FileStorageService } from './file-storage.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: PatientDocument.name, schema: PatientDocumentSchema }])],
    controllers: [DocumentsController],
    providers: [DocumentsService, FileStorageService],
})
export class DocumentsModule {}
