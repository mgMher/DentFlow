import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { Appointment, AppointmentSchema } from '../appointments/appointment.schema';
import { Invoice, InvoiceSchema } from '../billing/invoice.schema';
import { Payment, PaymentSchema } from '../billing/payment.schema';
import { Treatment, TreatmentSchema } from '../treatments/treatment.schema';
import { TreatmentEntry, TreatmentEntrySchema } from '../dental-records/treatment-entry.schema';
import { User, UserSchema } from '../auth/auth.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Clinic, ClinicSchema } from '../clinics/clinic.schema';
import { CommissionStatement, CommissionStatementSchema } from './commission-statement.schema';
import { CommissionService } from './commission.service';
import { CommissionController } from './commission.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Patient.name, schema: PatientSchema },
            { name: Appointment.name, schema: AppointmentSchema },
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Treatment.name, schema: TreatmentSchema },
            { name: TreatmentEntry.name, schema: TreatmentEntrySchema },
            { name: User.name, schema: UserSchema },
            { name: Clinic.name, schema: ClinicSchema },
            { name: CommissionStatement.name, schema: CommissionStatementSchema },
        ]),
    ],
    controllers: [ReportsController, CommissionController],
    providers: [ReportsService, CommissionService],
    exports: [ReportsService],
})
export class ReportsModule {}
