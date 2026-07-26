import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationsService } from './services/notifications.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationLog]), PushModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
