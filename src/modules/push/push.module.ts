import { Module } from '@nestjs/common';
import { PushController } from './controllers/push.controller';
import { WebPushService } from './services/web-push.service';

/**
 * Web Push delivery (VAPID). Exports WebPushService so the notification
 * pipeline can send alerts through it (roadmap A3). Device-token storage and
 * pruning land in A2/A4.
 */
@Module({
  controllers: [PushController],
  providers: [WebPushService],
  exports: [WebPushService],
})
export class PushModule {}
