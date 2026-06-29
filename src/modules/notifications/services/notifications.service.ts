import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { WhatsAppApiService } from './whatsapp-api.service';
import { Resident } from '../../residents/entities/resident.entity';

const ALERT_TEMPLATE_NAME = 'garbage_truck_alert';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationLog) private readonly logsRepo: Repository<NotificationLog>,
    private readonly whatsAppApiService: WhatsAppApiService,
  ) {}

  async sendProximityAlert(
    resident: Resident,
    routeId: number,
    currentStreetName: string,
    distanceBlocks: number,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const alreadyNotified = await this.logsRepo.findOne({
      where: { resident: { id: resident.id }, route: { id: routeId }, sentAt: today },
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
      }),
    );

    this.logger.log(
      `Alert sent to ${resident.phoneNumber} — truck on ${currentStreetName} [${result.status}]`,
    );
  }
}
