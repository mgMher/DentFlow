import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { Invoice, InvoiceSchema } from './invoice.schema';
import { Payment, PaymentSchema } from './payment.schema';
import { Patient, PatientSchema } from 'src/modules/patients/patient.schema';
import { TreatmentEntry, TreatmentEntrySchema } from 'src/modules/dental-records/treatment-entry.schema';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Invoice.name, schema: InvoiceSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Patient.name, schema: PatientSchema },
            { name: TreatmentEntry.name, schema: TreatmentEntrySchema },
        ]),
        NotificationsModule,
    ],
    controllers: [BillingController, AccountController],
    providers: [BillingService, AccountService],
    exports: [BillingService],
})
export class BillingModule {}
