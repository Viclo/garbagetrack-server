import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TruckPosition } from '../entities/truck-position.entity';
import { ProximityService } from '../../proximity/services/proximity.service';
import { GpsPositionInput } from '../dtos/inputs/gps-position.input';
import { ILatestTruckPosition, ISegmentMatch } from '../interfaces/tracking.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(TruckPosition) private readonly positionsRepo: Repository<TruckPosition>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly proximityService: ProximityService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** How far in the past a device clock may be before we stop believing it. */
  private static readonly MAX_FIX_AGE_MS = 6 * 60 * 60 * 1000;
  /** Tolerance for a device clock that runs slightly fast. */
  private static readonly MAX_FIX_SKEW_MS = 60 * 1000;

  /**
   * Trust the device's own timestamp, but only within reason (D6). A phone with
   * a wrong clock would otherwise poison every ETA — a fix "from the future"
   * would make the truck look permanently closer than it is. Anything
   * implausible falls back to the server clock.
   */
  private static toRecordedAt(deviceTimestamp?: number): Date {
    const now = Date.now();
    if (!deviceTimestamp || !Number.isFinite(deviceTimestamp)) return new Date(now);
    if (deviceTimestamp > now + TrackingService.MAX_FIX_SKEW_MS) return new Date(now);
    if (deviceTimestamp < now - TrackingService.MAX_FIX_AGE_MS) return new Date(now);
    return new Date(deviceTimestamp);
  }

  async processGpsUpdate(
    truckId: number,
    routeId: number,
    position: GpsPositionInput,
  ): Promise<ISegmentMatch | null> {
    const nearest = await this.findNearestSegment(routeId, position.latitude, position.longitude);

    await this.positionsRepo.save(
      this.positionsRepo.create({
        truck: { id: truckId } as never,
        latitude: position.latitude,
        longitude: position.longitude,
        currentSegmentIndex: nearest?.segmentIndex ?? null,
        recordedAt: TrackingService.toRecordedAt(position.timestamp),
        tenantId: this.tenantContext.tenantId,
      }),
    );

    if (nearest) {
      await this.proximityService
        .evaluate(routeId, nearest.segmentIndex, nearest.streetName)
        .catch((err) => this.logger.error('Proximity evaluation failed', err));
    }

    return nearest ?? null;
  }

  /**
   * Most recent GPS fix per truck, enriched with the route the truck is
   * currently running and the street that fix matched.
   *
   * `truck_positions` stores neither: it has no route_id at all, and the route
   * only exists on the open route_session. Without this join the admin map had
   * no route until a live socket event happened to arrive, so opening the map
   * showed "Ruta no disponible" and drew no route line — and never recovered if
   * the socket was down.
   */
  async getLatestPositions(): Promise<ILatestTruckPosition[]> {
    const rows = await this.dataSource.query<ILatestTruckPosition[]>(
      `SELECT DISTINCT ON (tp.truck_id)
              tp.truck_id              AS "truckId",
              session.route_id         AS "routeId",
              tp.latitude,
              tp.longitude,
              tp.current_segment_index AS "segmentIndex",
              seg.street_name          AS "streetName",
              -- Device time, not receive time: a batch of fixes that arrives
              -- after a signal gap must not make a truck look live at a place
              -- it left ten minutes ago.
              COALESCE(tp.recorded_at, tp.timestamp) AS "timestamp"
       FROM truck_positions tp
       -- LATERAL, not a plain join: a truck can carry more than one open
       -- session (two drivers), and this must resolve to exactly one row.
       LEFT JOIN LATERAL (
         SELECT rs.route_id
         FROM route_sessions rs
         WHERE rs.truck_id = tp.truck_id
           AND rs.tenant_id = tp.tenant_id
           AND rs.ended_at IS NULL
         ORDER BY rs.started_at DESC
         LIMIT 1
       ) session ON TRUE
       LEFT JOIN route_segments seg
              ON seg.route_id = session.route_id
             AND seg.segment_index = tp.current_segment_index
       WHERE tp.tenant_id = $1
       ORDER BY tp.truck_id, COALESCE(tp.recorded_at, tp.timestamp) DESC`,
      [this.tenantContext.tenantId],
    );
    return rows;
  }

  private async findNearestSegment(
    routeId: number,
    latitude: number,
    longitude: number,
  ): Promise<ISegmentMatch | null> {
    const results = await this.dataSource.query<ISegmentMatch[]>(
      `SELECT rs.id,
              rs.segment_index AS "segmentIndex",
              rs.street_name   AS "streetName"
       FROM route_segments rs
       JOIN routes r ON r.id = rs.route_id
       WHERE rs.route_id = $1
         AND r.tenant_id = $4
       ORDER BY rs.geom <-> ST_SetSRID(ST_MakePoint($2, $3), 4326)
       LIMIT 1`,
      [routeId, longitude, latitude, this.tenantContext.tenantId],
    );
    return results[0] ?? null;
  }
}
