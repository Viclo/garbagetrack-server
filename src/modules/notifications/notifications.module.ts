import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationsService } from './services/notifications.service';
import { WhatsAppApiService } from './services/whatsapp-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationLog]), HttpModule],
  providers: [NotificationsService, WhatsAppApiService],
  exports: [NotificationsService, WhatsAppApiService],
})
export class NotificationsModule {}
