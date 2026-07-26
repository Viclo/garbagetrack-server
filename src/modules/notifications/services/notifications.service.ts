import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { Resident } from '../../residents/entities/resident.entity';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { localDateString } from '../../../common/utils/local-time.util';
import { WebPushService } from '../../push/services/web-push.service';
import { PushSubscriptionsService } from '../../push/services/push-subscriptions.service';
import { IPushPayload } from '../../push/interfaces/push.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationLog) private readonly logsRepo: Repository<NotificationLog>,
    private readonly tenantContext: TenantContextService,
    private readonly webPushService: WebPushService,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
  ) {}

  /**
   * Deliver a "truck is near" alert to a resident via Web Push, fanning out to
   * all of their active subscriptions (phone + home browser). Enforces one
   * alert per resident/route/day. A resident with no active subscription is a
   * no-op that is NOT logged, so if they register later the same day they can
   * still be alerted.
   */
  async sendProximityAlert(
    resident: Resident,
    routeId: number,
    currentStreetName: string,
    distanceBlocks: number,
  ): Promise<void> {
    // Municipality-local date, NOT UTC: the "one alert per day" window must
    // roll over at local midnight, not at 20:00 La Paz time.
    const today = localDateString();
    const tenantId = this.tenantContext.tenantId;

    const alreadyNotified = await this.logsRepo.findOne({
      where: { resident: { id: resident.id }, route: { id: routeId }, sentAt: today, tenantId },
    });
    if (alreadyNotified) return;

    const subscriptions = await this.pushSubscriptionsService.findActiveByResident(resident.id);
    if (!subscriptions.length) return;

    const payload: IPushPayload = {
      title: '🚛 Camión basurero cerca',
      body: `El camión está en ${currentStreetName}, aprox. a ${distanceBlocks} cuadra(s) de tu casa.`,
      data: { url: '/' },
    };

    const results = await Promise.all(
      subscriptions.map(async (sub) => ({
        sub,
        result: await this.webPushService.send(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
        ),
      })),
    );

    const anySent = results.some(({ result }) => result.status === 'sent');
    const messageStatus = anySent ? 'sent' : 'failed';

    await this.logsRepo.save(
      this.logsRepo.create({
        resident,
        route: { id: routeId } as never,
        sentAt: today,
        channel: 'push',
        messageStatus,
        providerMessageId: null,
        tenantId,
      }),
    );

    this.logger.log(
      `Push alert to resident ${resident.id} — truck on ${currentStreetName} ` +
        `(${distanceBlocks} block(s)) → ${subscriptions.length} sub(s) [${messageStatus}]`,
    );
  }
}
