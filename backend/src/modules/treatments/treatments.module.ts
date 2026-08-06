import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';
import { Treatment, TreatmentSchema } from './treatment.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Treatment.name, schema: TreatmentSchema },
        ]),
    ],
    controllers: [TreatmentsController],
    providers: [TreatmentsService],
    exports: [TreatmentsService],
})
export class TreatmentsModule {}
