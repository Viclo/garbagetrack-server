import { Module } from '@nestjs/common';
import { ProximityService } from './services/proximity.service';
import { ResidentsModule } from '../residents/residents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [ResidentsModule, NotificationsModule, SystemConfigModule],
  providers: [ProximityService],
  exports: [ProximityService],
})
export class ProximityModule {}
