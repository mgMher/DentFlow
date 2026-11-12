import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DentalRecordsController } from './dental-records.controller';
import { DentalRecordsService } from './dental-records.service';
import { DentalRecord, DentalRecordSchema } from './dental-record.schema';
import { TreatmentEntry, TreatmentEntrySchema } from './treatment-entry.schema';
import { TreatmentPlan, TreatmentPlanSchema } from './treatment-plan.schema';
import { TreatmentPlansController } from './treatment-plans.controller';
import { TreatmentPlansService } from './treatment-plans.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DentalRecord.name, schema: DentalRecordSchema },
            { name: TreatmentEntry.name, schema: TreatmentEntrySchema },
            { name: TreatmentPlan.name, schema: TreatmentPlanSchema },
        ]),
    ],
    controllers: [DentalRecordsController, TreatmentPlansController],
    providers: [DentalRecordsService, TreatmentPlansService],
    exports: [DentalRecordsService],
})
export class DentalRecordsModule {}
