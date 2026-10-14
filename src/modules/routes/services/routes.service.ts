import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
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
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { ResidentsService } from '../../residents/services/residents.service';
import {
  chooseRouteColor,
  IColorNeighbour,
  leastUsedRouteColor,
  ROUTE_COLOR_NEIGHBOUR_RADIUS_M,
} from '../utils/route-color.util';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectRepository(Route) private readonly routesRepo: Repository<Route>,
    @InjectRepository(RouteSegment) private readonly segmentsRepo: Repository<RouteSegment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly residentsService: ResidentsService,
  ) {}

  async create(input: CreateRouteInput): Promise<IRoute> {
    const tenantId = this.tenantContext.tenantId;
    const existing = await this.routesRepo.findOne({ where: { name: input.name, tenantId } });
    if (existing) throw new ConflictException(`Route name "${input.name}" is already taken`);

    // No geometry yet, so no neighbours to avoid: take the least used colour
    // for now. replaceSegments re-picks it once the route is drawn.
    const { color, ...fields } = input;
    const route = this.routesRepo.create({
      ...fields,
      segments: [],
      tenantId,
      color: color ?? leastUsedRouteColor(await this.colorUsage(tenantId)),
      colorLocked: color !== undefined,
    });
    return this.routesRepo.save(route);
  }

  async findAll(): Promise<IRoute[]> {
    return this.routesRepo.find({
      where: { tenantId: this.tenantContext.tenantId },
      relations: ['segments'],
      order: { name: 'ASC', segments: { segmentIndex: 'ASC' } } as never,
    });
  }

  async findOne(id: number): Promise<IRoute> {
    const route = await this.routesRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['segments'],
      order: { segments: { segmentIndex: 'ASC' } } as never,
    });
    if (!route) throw new NotFoundException(`Route with ID ${id} not found`);
    return route;
  }

  async update(id: number, input: UpdateRouteInput): Promise<IRoute> {
    const route = await this.routesRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!route) throw new NotFoundException(`Route with ID ${id} not found`);

    const { color, ...fields } = input;
    Object.assign(route, fields);
    if (color !== undefined) {
      route.colorLocked = color !== null;
      if (color !== null) route.color = color;
    }
    await this.routesRepo.save(route);
    // Handed back to automatic: choose now, against the current neighbours.
    if (color === null) await this.assignAutomaticColor(id);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const route = await this.routesRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!route) throw new NotFoundException(`Route with ID ${id} not found`);
    await this.routesRepo.remove(route);
  }

  /**
   * Rebuilds the route's centerline from its segments, in order (B7). Every
   * path that mutates segments must call this: a stale centerline would keep
   * anchoring residents to a road that no longer exists. Routes with no
   * segments end up with a null centerline, which assignment skips.
   */
  async rebuildCenterline(routeId: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE routes
          SET centerline = c.line,
              centerline_length_m = CASE WHEN c.line IS NULL THEN NULL
                                         ELSE ST_Length(c.line::geography) END
         FROM (SELECT ST_MakeLine(line ORDER BY segment_index) AS line
                 FROM route_segments
                WHERE route_id = $1 AND line IS NOT NULL) c
        WHERE routes.id = $1`,
      [routeId],
    );
  }

  async addSegment(routeId: number, input: CreateSegmentInput): Promise<IRouteSegment> {
    const route = await this.routesRepo.findOne({
      where: { id: routeId, tenantId: this.tenantContext.tenantId },
    });
    if (!route) throw new NotFoundException(`Route with ID ${routeId} not found`);

    const existing = await this.segmentsRepo.findOne({
      where: { route: { id: routeId }, segmentIndex: input.segmentIndex },
    });
    if (existing)
      throw new ConflictException(
        `Segment index ${input.segmentIndex} already exists on this route`,
      );

    const segment = this.segmentsRepo.create({ ...input, route });
    const saved = await this.segmentsRepo.save(segment);
    await this.rebuildCenterline(routeId);
    return saved;
  }

  async replaceSegments(routeId: number, input: ReplaceSegmentsInput): Promise<IRoute> {
    const route = await this.routesRepo.findOne({
      where: { id: routeId, tenantId: this.tenantContext.tenantId },
    });
    if (!route) throw new NotFoundException(`Route with ID ${routeId} not found`);
    const firstDrawing = route.centerline === null;

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RouteSegment, { route: { id: routeId } });

      const segments = input.segments.map((seg, index) =>
        manager.create(RouteSegment, { ...seg, segmentIndex: index, route }),
      );
      // save() (not insert) so the @BeforeInsert geom/line hooks run.
      await manager.save(segments);
    });

    // The centerline is the chain of those segments, so it has to be rebuilt
    // before residents are re-anchored against it.
    await this.rebuildCenterline(routeId);

    // The colour is chosen against the neighbours the first time the route has
    // a shape, and then left alone: admins learn "the purple one", and a
    // redraw must not repaint it. A hand-picked colour is never touched.
    if (firstDrawing && !route.colorLocked) await this.assignAutomaticColor(routeId);

    // The new drawing renumbers segment_index, so every resident assignment on
    // this route is now stale — re-anchor them (and pick up residents that had
    // no route yet) with the same nearest-segment logic used at registration.
    const reassigned = await this.residentsService.reassignByRoute(routeId);
    if (reassigned > 0) {
      this.logger.log(`Route ${routeId} segments replaced: re-anchored ${reassigned} resident(s)`);
    }

    return this.findOne(routeId);
  }

  async updateSegment(segmentId: number, input: UpdateSegmentInput): Promise<IRouteSegment> {
    const segment = await this.findSegmentInTenant(segmentId);
    const routeId = segment.route.id;
    Object.assign(segment, input);
    const saved = await this.segmentsRepo.save(segment);
    await this.rebuildCenterline(routeId);
    return saved;
  }

  async removeSegment(segmentId: number): Promise<void> {
    const segment = await this.findSegmentInTenant(segmentId);
    const routeId = segment.route.id;
    await this.segmentsRepo.remove(segment);
    await this.rebuildCenterline(routeId);
  }

  /**
   * Gives the route the palette colour that clashes least with the active
   * routes around it (see route-color.util.ts for the rule and its limits).
   * A route with no geometry only balances usage across the municipality.
   */
  async assignAutomaticColor(routeId: number): Promise<void> {
    const tenantId = this.tenantContext.tenantId;
    const neighbours = await this.dataSource.query<IColorNeighbour[]>(
      `SELECT o.color,
              ST_Distance(r.centerline::geography, o.centerline::geography) AS "distanceM",
              (SELECT count(DISTINCT a.day_of_week)::int
                 FROM weekly_schedules a
                 JOIN weekly_schedules b ON b.day_of_week = a.day_of_week AND b.route_id = o.id
                WHERE a.route_id = r.id) AS "sharedDays"
         FROM routes r
         JOIN routes o ON o.tenant_id = r.tenant_id AND o.id <> r.id
                      AND o.is_active AND o.centerline IS NOT NULL
        WHERE r.id = $1 AND r.tenant_id = $2 AND r.centerline IS NOT NULL
          AND ST_DWithin(r.centerline::geography, o.centerline::geography, $3)`,
      [routeId, tenantId, ROUTE_COLOR_NEIGHBOUR_RADIUS_M],
    );
    const color = chooseRouteColor(
      neighbours.map((n) => ({ ...n, distanceM: Number(n.distanceM), sharedDays: Number(n.sharedDays) })),
      await this.colorUsage(tenantId, routeId),
    );
    await this.routesRepo.update({ id: routeId, tenantId }, { color, colorLocked: false });
  }

  /** How many of the municipality's routes use each colour, optionally excluding one. */
  private async colorUsage(tenantId: number, excludeRouteId?: number): Promise<Record<string, number>> {
    const rows = await this.dataSource.query<Array<{ color: string; count: string }>>(
      `SELECT color, count(*) AS count FROM routes
        WHERE tenant_id = $1 AND ($2::int IS NULL OR id <> $2)
        GROUP BY color`,
      [tenantId, excludeRouteId ?? null],
    );
    return Object.fromEntries(rows.map((r) => [r.color, Number(r.count)]));
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.routesRepo.count({
      where: { tenantId: this.tenantContext.tenantId },
    });
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

  async findNearestSegmentGlobal(
    latitude: number,
    longitude: number,
  ): Promise<INearestSegmentResult | null> {
    // Finds nearest segment across all active routes OF THIS TENANT for
    // resident auto-assignment.
    const results = await this.dataSource.query<Array<INearestSegmentResult>>(
      `SELECT rs.route_id   AS "routeId",
              rs.segment_index AS "segmentIndex",
              rs.street_name   AS "streetName"
       FROM route_segments rs
       JOIN routes r ON r.id = rs.route_id
       WHERE r.is_active = true
         AND r.tenant_id = $3
       ORDER BY rs.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [longitude, latitude, this.tenantContext.tenantId],
    );
    return results[0] ?? null;
  }

  private async findSegmentInTenant(segmentId: number): Promise<RouteSegment> {
    const segment = await this.segmentsRepo.findOne({
      where: { id: segmentId, route: { tenantId: this.tenantContext.tenantId } },
      // The route is needed to rebuild its centerline after the segment changes.
      relations: ['route'],
    });
    if (!segment) throw new NotFoundException(`Segment with ID ${segmentId} not found`);
    return segment;
  }
}
