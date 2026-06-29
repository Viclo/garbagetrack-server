import { Module } from '@nestjs/common';
import { WhatsappWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsappInfoController } from './controllers/whatsapp-info.controller';
import { WhatsappWebhookService } from './services/whatsapp-webhook.service';
import { ResidentsModule } from '../residents/residents.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ResidentsModule, NotificationsModule],
  controllers: [WhatsappWebhookController, WhatsappInfoController],
  providers: [WhatsappWebhookService],
})
export class WhatsappWebhookModule {}
