import { Injectable, Logger } from '@nestjs/common';
import { ResidentsService } from '../../residents/services/residents.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { AlertStage, IRouteProgress, ITruckMotion } from '../interfaces/proximity.interface';

/**
 * Decides who to warn, and when (roadmap B8).
 *
 * The old engine matched residents whose segment index equalled the truck's
 * plus a fixed number of "blocks". Segments are not blocks — on a real route
 * they ran from 129 m to 7.6 km — so the trigger was unreachable for some
 * residents and instant for others. This works in time instead: how long until
 * the truck reaches the point where the resident actually hands over the bag.
 *
 * Two alerts per resident per day at most:
 *  - 'prepare'  ~notify_lead_minutes before arrival, so there is time to bag
 *               the trash and walk out
 *  - 'arriving' when the truck is at their street — the digital replacement
 *               for the horn, and the one that still fires when the first was
 *               missed, because on a weekly route silence costs seven days
 */
@Injectable()
export class ProximityService {
  private readonly logger = new Logger(ProximityService.name);

  /**
   * How far off the centerline a fix may be and still count as "on the route".
   * A truck driving to the route, or detouring around an obstacle, must not
   * generate arrival times for streets it is not on.
   */
  private static readonly ON_ROUTE_TOLERANCE_M = 150;
  /** Ignore fixes this old when measuring speed — the truck may have stopped since. */
  private static readonly MOTION_WINDOW_MS = 10 * 60 * 1000;
  /** Below this the truck is loading, not travelling; measured speed is meaningless. */
  private static readonly MIN_MEASURABLE_SPEED_MPS = 0.5;

  constructor(
    private readonly residentsService: ResidentsService,
    private readonly notificationsService: NotificationsService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async evaluate(progress: IRouteProgress): Promise<void> {
    if (progress.offRouteM > ProximityService.ON_ROUTE_TOLERANCE_M) return;

    const [leadMinutes, arrivalDistanceM] = await Promise.all([
      this.systemConfigService.getNotifyLeadMinutes(),
      this.systemConfigService.getArrivalDistanceM(),
    ]);

    const motion = await this.measureMotion(progress);
    const leadDistanceM = motion.speedMps * leadMinutes * 60;

    // Look ahead by the lead distance, and a little behind: a resident the
    // truck has just passed still deserves the arrival alert.
    const ahead = motion.direction >= 0 ? leadDistanceM : arrivalDistanceM;
    const behind = motion.direction >= 0 ? arrivalDistanceM : leadDistanceM;
    const candidates = await this.residentsService.findActiveByRouteOffsetRange(
      progress.routeId,
      progress.offsetM - behind,
      progress.offsetM + ahead,
    );
    if (!candidates.length) return;

    // The fix may have waited in the driver app's queue during a signal gap, so
    // the truck is already this much further along than the numbers suggest.
    const fixAgeSeconds = Math.max(0, (Date.now() - progress.recordedAt.getTime()) / 1000);

    for (const resident of candidates) {
      if (resident.routeOffsetM === null) continue;

      const delta = resident.routeOffsetM - progress.offsetM;
      const metresApart = Math.abs(delta);
      // Positive means the truck still has to travel to reach them.
      const metresAhead = motion.direction === -1 ? -delta : delta;

      let stage: AlertStage | null = null;
      let etaMinutes: number | null = null;

      if (metresApart <= arrivalDistanceM) {
        stage = 'arriving';
      } else if (motion.direction !== 0 && metresAhead > 0) {
        const etaSeconds = metresAhead / motion.speedMps - fixAgeSeconds;
        if (etaSeconds <= leadMinutes * 60) {
          // A stale fix can put the truck past them already; that is an
          // arrival, not a promise of twenty minutes that no longer exists.
          stage = etaSeconds <= 0 ? 'arriving' : 'prepare';
          etaMinutes = stage === 'prepare' ? Math.max(1, Math.round(etaSeconds / 60)) : null;
        }
      }

      if (!stage) continue;

      await this.notificationsService.sendStageAlert({
        resident,
        routeId: progress.routeId,
        stage,
        streetName: progress.streetName,
        etaMinutes,
      });
    }
  }

  /**
   * Direction and pace from the truck's own recent fixes. Direction cannot be
   * assumed from segment order — a route is driven in whichever direction the
   * driver takes it, and it is stored in one fixed order.
   */
  private async measureMotion(progress: IRouteProgress): Promise<ITruckMotion> {
    const fallbackSpeedMps = ((await this.systemConfigService.getAvgTruckSpeedKmh()) * 1000) / 3600;

    const earlier = progress.previous;
    const tooOld =
      earlier &&
      progress.recordedAt.getTime() - earlier.recordedAt.getTime() >
        ProximityService.MOTION_WINDOW_MS;
    if (!earlier || tooOld) return { direction: 0, speedMps: fallbackSpeedMps, estimated: true };

    const metres = progress.offsetM - earlier.offsetM;
    const seconds = (progress.recordedAt.getTime() - earlier.recordedAt.getTime()) / 1000;
    if (seconds <= 0) return { direction: 0, speedMps: fallbackSpeedMps, estimated: true };

    const speedMps = Math.abs(metres) / seconds;
    const direction = metres > 0 ? 1 : metres < 0 ? -1 : 0;

    // A truck idling at a stop would otherwise report a speed near zero and
    // push every ETA to hours away.
    if (speedMps < ProximityService.MIN_MEASURABLE_SPEED_MPS) {
      return { direction, speedMps: fallbackSpeedMps, estimated: true };
    }

    return { direction, speedMps, estimated: false };
  }
}
