import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TruckPosition } from '../entities/truck-position.entity';
import { ProximityService } from '../../proximity/services/proximity.service';
import { GpsPositionInput } from '../dtos/inputs/gps-position.input';
import { ISegmentMatch } from '../interfaces/tracking.interface';
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

  async getLatestPositions(): Promise<
    Array<{ truckId: number; latitude: number; longitude: number; timestamp: Date }>
  > {
    // Returns the most recent GPS position for each active truck of this tenant
    const rows = await this.dataSource.query<
      Array<{ truckId: number; latitude: number; longitude: number; timestamp: Date }>
    >(
      `SELECT DISTINCT ON (truck_id)
              truck_id  AS "truckId",
              latitude,
              longitude,
              timestamp
       FROM truck_positions
       WHERE tenant_id = $1
       ORDER BY truck_id, timestamp DESC`,
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
