import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushController } from './controllers/push.controller';
import { WebPushService } from './services/web-push.service';
import { PushSubscriptionsService } from './services/push-subscriptions.service';
import { PushSubscription } from './entities/push-subscription.entity';

/**
 * Web Push delivery (VAPID) + subscription storage. Exports WebPushService and
 * PushSubscriptionsService so the notification pipeline can fan alerts out to a
 * resident's devices (roadmap A3) and the public endpoints can register /
 * unsubscribe them (B1/B3).
 */
@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  controllers: [PushController],
  providers: [WebPushService, PushSubscriptionsService],
  exports: [WebPushService, PushSubscriptionsService],
})
export class PushModule {}
