import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DentalRecord, DentalRecordSchema } from '../dental-records/dental-record.schema';
import { PerioExam, PerioExamSchema } from './perio-exam.schema';
import { PerioController } from './perio.controller';
import { PerioService } from './perio.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: PerioExam.name, schema: PerioExamSchema },
            { name: DentalRecord.name, schema: DentalRecordSchema },
        ]),
    ],
    controllers: [PerioController],
    providers: [PerioService],
})
export class PerioModule {}
