import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationTemplate, NotificationTemplateSchema } from './notification-template.schema';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
        ]),
    ],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule {}
