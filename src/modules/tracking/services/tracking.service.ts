import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TruckPosition } from '../entities/truck-position.entity';
import { ProximityService } from '../../proximity/services/proximity.service';
import { GpsPositionInput } from '../dtos/inputs/gps-position.input';
import { ISegmentMatch } from '../interfaces/tracking.interface';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(TruckPosition) private readonly positionsRepo: Repository<TruckPosition>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly proximityService: ProximityService,
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
    // Returns the most recent GPS position for each active truck
    const rows = await this.dataSource.query<
      Array<{ truckId: number; latitude: number; longitude: number; timestamp: Date }>
    >(
      `SELECT DISTINCT ON (truck_id)
              truck_id  AS "truckId",
              latitude,
              longitude,
              timestamp
       FROM truck_positions
       ORDER BY truck_id, timestamp DESC`,
    );
    return rows;
  }

  private async findNearestSegment(
    routeId: number,
    latitude: number,
    longitude: number,
  ): Promise<ISegmentMatch | null> {
    const results = await this.dataSource.query<ISegmentMatch[]>(
      `SELECT id,
              segment_index AS "segmentIndex",
              street_name   AS "streetName"
       FROM route_segments
       WHERE route_id = $1
       ORDER BY geom <-> ST_SetSRID(ST_MakePoint($2, $3), 4326)
       LIMIT 1`,
      [routeId, longitude, latitude],
    );
    return results[0] ?? null;
  }
}
