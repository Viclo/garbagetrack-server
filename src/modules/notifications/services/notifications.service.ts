import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { Resident } from '../../residents/entities/resident.entity';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { localDateString } from '../../../common/utils/local-time.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationLog) private readonly logsRepo: Repository<NotificationLog>,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Deliver a "truck is near" alert to a resident.
   *
   * TRANSPORT PENDING: WhatsApp delivery was removed in the mobile migration.
   * The Web Push channel replaces it (roadmap A1–A3). Until then this records
   * the alert (preserving the one-per-day dedup so the future push channel
   * won't double-notify) and logs the intent — it does not yet send anything.
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

    await this.logsRepo.save(
      this.logsRepo.create({
        resident,
        route: { id: routeId } as never,
        sentAt: today,
        messageStatus: 'pending',
        waMessageId: null,
        tenantId,
      }),
    );

    this.logger.log(
      `Proximity alert for ${resident.phoneNumber} — truck on ${currentStreetName} ` +
        `(${distanceBlocks} block(s) away) [transport pending: push channel not yet implemented]`,
    );
  }
}
