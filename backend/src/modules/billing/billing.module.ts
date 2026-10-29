import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice, InvoiceSchema } from './invoice.schema';
import { Payment, PaymentSchema } from './payment.schema';
import { Patient, PatientSchema } from 'src/modules/patients/patient.schema';
import { TreatmentEntry, TreatmentEntrySchema } from 'src/modules/dental-records/treatment-entry.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Patient.name, schema: PatientSchema },
            { name: TreatmentEntry.name, schema: TreatmentEntrySchema },
        ]),
    ],
    controllers: [BillingController],
    providers: [BillingService],
    exports: [BillingService],
})
export class BillingModule {}
