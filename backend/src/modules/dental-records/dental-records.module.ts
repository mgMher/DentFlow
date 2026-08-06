import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DentalRecordsController } from './dental-records.controller';
import { DentalRecordsService } from './dental-records.service';
import { DentalRecord, DentalRecordSchema } from './dental-record.schema';
import { TreatmentEntry, TreatmentEntrySchema } from './treatment-entry.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DentalRecord.name, schema: DentalRecordSchema },
            { name: TreatmentEntry.name, schema: TreatmentEntrySchema },
        ]),
    ],
    controllers: [DentalRecordsController],
    providers: [DentalRecordsService],
    exports: [DentalRecordsService],
})
export class DentalRecordsModule {}
