import { Module } from '@nestjs/common';
import { ObjectIdRepairService } from './objectid-repair.service';

/** Data repairs that must run before feature modules read the data. Import first in AppModule. */
@Module({ providers: [ObjectIdRepairService] })
export class MigrationsModule {}
