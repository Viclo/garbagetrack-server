import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { WhatsAppApiService } from './whatsapp-api.service';
import { Resident } from '../../residents/entities/resident.entity';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { localDateString } from '../../../common/utils/local-time.util';

const ALERT_TEMPLATE_NAME = 'garbage_truck_alert';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationLog) private readonly logsRepo: Repository<NotificationLog>,
    private readonly whatsAppApiService: WhatsAppApiService,
    private readonly tenantContext: TenantContextService,
  ) {}

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

    const result = await this.whatsAppApiService.sendTemplateMessage(
      resident.phoneNumber,
      ALERT_TEMPLATE_NAME,
      [currentStreetName, String(distanceBlocks)],
    );

    await this.logsRepo.save(
      this.logsRepo.create({
        resident,
        route: { id: routeId } as never,
        sentAt: today,
        messageStatus: result.status,
        waMessageId: result.messageId || null,
        tenantId,
      }),
    );

    this.logger.log(
      `Alert sent to ${resident.phoneNumber} — truck on ${currentStreetName} [${result.status}]`,
    );
  }
}
