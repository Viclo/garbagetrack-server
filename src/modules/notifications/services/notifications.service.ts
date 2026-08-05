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
import { TenantsService } from '../../tenants/services/tenants.service';
import { AlertStage } from '../../proximity/interfaces/proximity.interface';
import { IStageAlertInput } from '../interfaces/notification.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  /** tenantId → slug. Slugs are effectively immutable and this runs per alert. */
  private readonly slugCache = new Map<number, string>();

  constructor(
    @InjectRepository(NotificationLog) private readonly logsRepo: Repository<NotificationLog>,
    private readonly tenantContext: TenantContextService,
    private readonly webPushService: WebPushService,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Where tapping the notification should land. Without this the payload said
   * "/", which is the admin login — a resident who tapped their own alert got a
   * staff sign-in form. Falls back to "/" only if the tenant vanished, which
   * cannot happen for a tenant we are actively notifying for.
   */
  private async residentUrl(tenantId: number): Promise<string> {
    const cached = this.slugCache.get(tenantId);
    if (cached) return `/r/${cached}/live`;

    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant) return '/';
    this.slugCache.set(tenantId, tenant.slug);
    // The live map (E4), not the registration page: the alert has just told
    // them the truck is coming, and "where is it now" is the only question
    // they open it to answer. The page itself falls back to their status
    // screen when there is nothing to watch.
    return `/r/${tenant.slug}/live`;
  }

  /**
   * Deliver one of the day's two alerts to a resident via Web Push, fanning out
   * to all of their active subscriptions (phone + home browser).
   *
   * Each stage dedups independently per resident/route/day, so the arrival
   * alert still lands for someone who already got the 20-minute warning — and,
   * more importantly, for someone who never did because the signal dropped. On
   * a weekly route silence costs seven days, so a late "está en tu calle" is
   * always worth sending.
   *
   * A resident with no active subscription is a no-op that is NOT logged, so if
   * they register later the same day they can still be alerted.
   */
  async sendStageAlert(input: IStageAlertInput): Promise<void> {
    const { resident, routeId, stage, streetName, etaMinutes } = input;
    // Municipality-local date, NOT UTC: the "once per day" window must roll
    // over at local midnight, not at 20:00 La Paz time.
    const today = localDateString();
    const tenantId = this.tenantContext.tenantId;

    const alreadyNotified = await this.logsRepo.findOne({
      where: {
        resident: { id: resident.id },
        route: { id: routeId },
        sentAt: today,
        stage,
        tenantId,
      },
    });
    if (alreadyNotified) return;

    const subscriptions = await this.pushSubscriptionsService.findActiveByResident(resident.id);
    if (!subscriptions.length) return;

    const payload: IPushPayload = {
      ...this.buildStageMessage(stage, streetName, etaMinutes),
      data: { url: await this.residentUrl(tenantId) },
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

    // A4: prune subscriptions the push service reports as gone (revoked
    // permission, cleared data, PWA removed) so we stop sending to them.
    const dead = results.filter(
      ({ result }) => result.statusCode === 404 || result.statusCode === 410,
    );
    if (dead.length) {
      await Promise.all(
        dead.map(({ sub }) => this.pushSubscriptionsService.deactivateByEndpoint(sub.endpoint)),
      );
      this.logger.log(`Pruned ${dead.length} dead subscription(s) for resident ${resident.id}`);
    }

    const anySent = results.some(({ result }) => result.status === 'sent');
    const messageStatus = anySent ? 'sent' : 'failed';

    await this.logsRepo.save(
      this.logsRepo.create({
        resident,
        route: { id: routeId } as never,
        sentAt: today,
        stage,
        channel: 'push',
        messageStatus,
        providerMessageId: null,
        tenantId,
      }),
    );

    this.logger.log(
      `Push '${stage}' to resident ${resident.id} — truck on ${streetName ?? 'ruta'}` +
        `${etaMinutes ? `, ETA ~${etaMinutes} min` : ''} → ` +
        `${subscriptions.length} sub(s) [${messageStatus}]`,
    );
  }

  /**
   * The two messages a resident can get. The first buys them time to bag the
   * trash and walk out; the second is the horn — it means "now", so it says so
   * rather than quoting a number of minutes.
   */
  private buildStageMessage(
    stage: AlertStage,
    streetName: string | null,
    etaMinutes: number | null,
  ): { title: string; body: string } {
    const street = streetName ?? 'tu zona';

    if (stage === 'arriving') {
      return {
        title: '🚛 El camión está en tu calle',
        body: `El camión basurero está pasando por ${street}. Saca tu bolsa ahora.`,
      };
    }

    const minutes = etaMinutes ?? 20;
    return {
      title: '🚛 El camión se acerca',
      body: `El camión está en ${street} y llega a tu casa en ~${minutes} minutos. Prepara tu bolsa.`,
    };
  }
}
