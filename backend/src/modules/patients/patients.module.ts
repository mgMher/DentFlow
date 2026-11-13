import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Patient, PatientSchema } from './patient.schema';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Patient.name, schema: PatientSchema },
        ]),
    ],
    controllers: [PatientsController, FamilyController],
    providers: [PatientsService, FamilyService],
    exports: [PatientsService, FamilyService],
})
export class PatientsModule {}
