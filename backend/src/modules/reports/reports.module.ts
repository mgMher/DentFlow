import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { Appointment, AppointmentSchema } from '../appointments/appointment.schema';
import { Invoice, InvoiceSchema } from '../billing/invoice.schema';
import { Payment, PaymentSchema } from '../billing/payment.schema';
import { Treatment, TreatmentSchema } from '../treatments/treatment.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Patient.name, schema: PatientSchema },
            { name: Appointment.name, schema: AppointmentSchema },
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Treatment.name, schema: TreatmentSchema },
        ]),
    ],
    controllers: [ReportsController],
    providers: [ReportsService],
    exports: [ReportsService],
})
export class ReportsModule {}
