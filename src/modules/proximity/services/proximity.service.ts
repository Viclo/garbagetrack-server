import { Injectable, Logger } from '@nestjs/common';
import { ResidentsService } from '../../residents/services/residents.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';

@Injectable()
export class ProximityService {
  private readonly logger = new Logger(ProximityService.name);

  constructor(
    private readonly residentsService: ResidentsService,
    private readonly notificationsService: NotificationsService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async evaluate(
    routeId: number,
    currentSegmentIndex: number,
    currentStreetName: string,
  ): Promise<void> {
    const notificationBlocks = await this.systemConfigService.getNotificationBlocks();
    const targetSegmentIndex = currentSegmentIndex + notificationBlocks;

    const residents = await this.residentsService.findActiveByRouteAndSegment(
      routeId,
      targetSegmentIndex,
    );

    if (!residents.length) return;

    this.logger.debug(
      `Truck on ${currentStreetName} (seg ${currentSegmentIndex}). Notifying ${residents.length} resident(s) at seg ${targetSegmentIndex}`,
    );

    await Promise.all(
      residents.map((resident) =>
        this.notificationsService.sendProximityAlert(
          resident,
          routeId,
          currentStreetName,
          notificationBlocks,
        ),
      ),
    );
  }
}
