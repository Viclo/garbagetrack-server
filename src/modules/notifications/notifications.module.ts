import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationLog])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
