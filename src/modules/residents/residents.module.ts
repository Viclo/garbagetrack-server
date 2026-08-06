import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from './entities/resident.entity';
import { ResidentsController } from './controllers/residents.controller';
import { PublicResidentsController } from './controllers/public-residents.controller';
import { ResidentsService } from './services/residents.service';
import { ResidentRegistrationService } from './services/resident-registration.service';
import { PushModule } from '../push/push.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // NotificationsModule is one-way here: it never imports residents back (the
  // alert pipeline reaches residents through ProximityModule), so listing a
  // resident's delivery history introduces no cycle.
  imports: [
    TypeOrmModule.forFeature([Resident]),
    PushModule,
    SystemConfigModule,
    NotificationsModule,
  ],
  controllers: [ResidentsController, PublicResidentsController],
  providers: [ResidentsService, ResidentRegistrationService],
  exports: [ResidentsService],
})
export class ResidentsModule {}
