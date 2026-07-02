import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Route } from '../entities/route.entity';
import { RouteSegment } from '../entities/route-segment.entity';
import { CreateRouteInput } from '../dtos/inputs/create-route.input';
import { UpdateRouteInput } from '../dtos/inputs/update-route.input';
import { CreateSegmentInput } from '../dtos/inputs/create-segment.input';
import { UpdateSegmentInput } from '../dtos/inputs/update-segment.input';
import { ReplaceSegmentsInput } from '../dtos/inputs/replace-segments.input';
import { INearestSegmentResult, IRoute, IRouteSegment } from '../interfaces/route.interface';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private readonly routesRepo: Repository<Route>,
    @InjectRepository(RouteSegment) private readonly segmentsRepo: Repository<RouteSegment>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateRouteInput): Promise<IRoute> {
    const existing = await this.routesRepo.findOne({ where: { name: input.name } });
    if (existing) throw new ConflictException(`Route name "${input.name}" is already taken`);

    const route = this.routesRepo.create({ ...input, segments: [] });
    return this.routesRepo.save(route);
  }

  async findAll(): Promise<IRoute[]> {
    return this.routesRepo.find({
      relations: ['segments'],
      order: { name: 'ASC', segments: { segmentIndex: 'ASC' } } as never,
    });
  }

  async findOne(id: number): Promise<IRoute> {
    const route = await this.routesRepo.findOne({
      where: { id },
      relations: ['segments'],
      order: { segments: { segmentIndex: 'ASC' } } as never,
    });
    if (!route) throw new NotFoundException(`Route with ID ${id} not found`);
    return route;
  }

  async update(id: number, input: UpdateRouteInput): Promise<IRoute> {
    const route = await this.routesRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException(`Route with ID ${id} not found`);

    Object.assign(route, input);
    await this.routesRepo.save(route);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const route = await this.routesRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException(`Route with ID ${id} not found`);
    await this.routesRepo.remove(route);
  }

  async addSegment(routeId: number, input: CreateSegmentInput): Promise<IRouteSegment> {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException(`Route with ID ${routeId} not found`);

    const existing = await this.segmentsRepo.findOne({
      where: { route: { id: routeId }, segmentIndex: input.segmentIndex },
    });
    if (existing)
      throw new ConflictException(
        `Segment index ${input.segmentIndex} already exists on this route`,
      );

    const segment = this.segmentsRepo.create({ ...input, route });
    return this.segmentsRepo.save(segment);
  }

  async replaceSegments(routeId: number, input: ReplaceSegmentsInput): Promise<IRoute> {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException(`Route with ID ${routeId} not found`);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RouteSegment, { route: { id: routeId } });

      const segments = input.segments.map((seg, index) =>
        manager.create(RouteSegment, { ...seg, segmentIndex: index, route }),
      );
      // save() (not insert) so the @BeforeInsert geom midpoint hook runs.
      await manager.save(segments);
    });

    return this.findOne(routeId);
  }

  async updateSegment(segmentId: number, input: UpdateSegmentInput): Promise<IRouteSegment> {
    const segment = await this.segmentsRepo.findOne({ where: { id: segmentId } });
    if (!segment) throw new NotFoundException(`Segment with ID ${segmentId} not found`);

    Object.assign(segment, input);
    return this.segmentsRepo.save(segment);
  }

  async removeSegment(segmentId: number): Promise<void> {
    const segment = await this.segmentsRepo.findOne({ where: { id: segmentId } });
    if (!segment) throw new NotFoundException(`Segment with ID ${segmentId} not found`);
    await this.segmentsRepo.remove(segment);
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.routesRepo.count();
    return { total };
  }

  async findNearestSegmentOnRoute(
    routeId: number,
    latitude: number,
    longitude: number,
  ): Promise<{ id: number; segmentIndex: number; streetName: string } | null> {
    // Uses PostGIS KNN <-> operator for efficient nearest-neighbor search.
    // Requires a GiST index on route_segments.geom for optimal performance.
    const results = await this.dataSource.query<
      Array<{ id: number; segmentIndex: number; streetName: string }>
    >(
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

  async findNearestSegmentGlobal(
    latitude: number,
    longitude: number,
  ): Promise<INearestSegmentResult | null> {
    // Finds nearest segment across all active routes for resident auto-assignment.
    const results = await this.dataSource.query<Array<INearestSegmentResult>>(
      `SELECT rs.route_id   AS "routeId",
              rs.segment_index AS "segmentIndex",
              rs.street_name   AS "streetName"
       FROM route_segments rs
       JOIN routes r ON r.id = rs.route_id
       WHERE r.is_active = true
       ORDER BY rs.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [longitude, latitude],
    );
    return results[0] ?? null;
  }
}
