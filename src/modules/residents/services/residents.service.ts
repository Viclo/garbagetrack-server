import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { Resident } from '../entities/resident.entity';
import { ICollectionPoint, IResident } from '../interfaces/resident.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { UpdateResidentInput } from '../dtos/inputs/update-resident.input';
import {
  generateOwnerToken,
  hashOwnerToken,
  verifyOwnerToken as verifyTokenHash,
} from '../../../common/utils/owner-token.util';
import { SystemConfigService } from '../../system-config/services/system-config.service';

@Injectable()
export class ResidentsService {
  constructor(
    @InjectRepository(Resident) private readonly residentsRepo: Repository<Resident>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * Mint a fresh owner token for a resident, persist its hash, and return the
   * raw token to hand back to the registering device exactly once (B1). Issuing
   * a new one rotates any previous token.
   */
  async issueOwnerToken(residentId: number): Promise<string> {
    const rawToken = generateOwnerToken();
    await this.residentsRepo.update(
      { id: residentId, tenantId: this.tenantContext.tenantId },
      { ownerToken: hashOwnerToken(rawToken) },
    );
    return rawToken;
  }

  /**
   * Authorize a resident self-service write: true only when the presented raw
   * token matches the stored hash for this resident in this tenant. The hash
   * column is `select: false`, so it is fetched explicitly here.
   */
  async verifyOwnerToken(residentId: number, rawToken: string): Promise<boolean> {
    const resident = await this.residentsRepo.findOne({
      where: { id: residentId, tenantId: this.tenantContext.tenantId },
      select: { id: true, ownerToken: true },
    });
    if (!resident?.ownerToken) return false;
    return verifyTokenHash(rawToken, resident.ownerToken);
  }

  /**
   * Register a NEW resident record (Option A: device-owned). Always inserts —
   * it never upserts by phone, because the phone is a label, not an identity,
   * and matching-by-phone would let a public caller overwrite a stranger's
   * record. Anchors the resident to a collection point on the nearest route,
   * or to none at all when every route is beyond walking distance (B7).
   */
  async register(
    phoneNumber: string,
    latitude: number,
    longitude: number,
    name: string | null = null,
  ): Promise<Resident> {
    const tenantId = this.tenantContext.tenantId;
    const point = await this.findCollectionPoint(latitude, longitude);

    const resident = this.residentsRepo.create({
      phoneNumber,
      name,
      latitude,
      longitude,
      tenantId,
    });
    // No point means no route within walking distance: the record is kept so
    // the resident exists for the municipality, but it receives no alerts.
    this.applyCollectionPoint(resident, point);
    return this.residentsRepo.save(resident);
  }

  /**
   * Where a resident hands their bag over: the nearest point on a route's
   * centerline, provided it is within walking distance (B7).
   *
   * Returns null when the nearest route is further than max_snap_distance_m —
   * that resident is not served by any route, and saying otherwise would send
   * them alerts for a truck they can never reach. Distances are geography
   * (metres) against the real road line, not the old per-segment midpoint,
   * which on a kilometres-long street was nowhere near most of the road.
   */
  private async findCollectionPoint(
    latitude: number,
    longitude: number,
  ): Promise<ICollectionPoint | null> {
    const tenantId = this.tenantContext.tenantId;

    const [nearestRoute] = await this.dataSource.query<
      Array<{ routeId: number; distanceM: number; offsetM: number }>
    >(
      `SELECT r.id AS "routeId",
              ST_Distance(pt.g::geography, r.centerline::geography) AS "distanceM",
              ST_LineLocatePoint(r.centerline, pt.g) * r.centerline_length_m AS "offsetM"
         FROM routes r,
              (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS g) pt
        WHERE r.tenant_id = $3
          AND r.is_active = true
          AND r.centerline IS NOT NULL
        ORDER BY ST_Distance(pt.g::geography, r.centerline::geography)
        LIMIT 1`,
      [longitude, latitude, tenantId],
    );

    if (!nearestRoute) return null;

    const maxDistance = await this.systemConfigService.getMaxSnapDistanceM();
    if (nearestRoute.distanceM > maxDistance) return null;

    // The segment only names the street for the alert ("el camión está en …").
    const segment = await this.findNearestSegmentOnRoute(nearestRoute.routeId, latitude, longitude);

    return {
      routeId: nearestRoute.routeId,
      segmentIndex: segment?.segmentIndex ?? null,
      streetName: segment?.streetName ?? null,
      offsetM: nearestRoute.offsetM,
      distanceM: nearestRoute.distanceM,
    };
  }

  /**
   * The collection point on a SPECIFIC route, however far away it is (E5).
   * findCollectionPoint() picks the nearest route and enforces the walking
   * limit; this one obeys the admin instead.
   */
  private async pointOnRoute(
    routeId: number,
    latitude: number,
    longitude: number,
  ): Promise<ICollectionPoint> {
    const [route] = await this.dataSource.query<Array<{ distanceM: number; offsetM: number }>>(
      `SELECT ST_Distance(pt.g::geography, r.centerline::geography) AS "distanceM",
              ST_LineLocatePoint(r.centerline, pt.g) * r.centerline_length_m AS "offsetM"
         FROM routes r,
              (SELECT ST_SetSRID(ST_MakePoint($2, $3), 4326) AS g) pt
        WHERE r.id = $1
          AND r.tenant_id = $4
          AND r.centerline IS NOT NULL`,
      [routeId, longitude, latitude, this.tenantContext.tenantId],
    );
    if (!route) {
      // Either the route is not this tenant's, or it has no drawing yet.
      throw new NotFoundException(`Route with ID ${routeId} not found or has no path drawn`);
    }

    const segment = await this.findNearestSegmentOnRoute(routeId, latitude, longitude);
    return {
      routeId,
      segmentIndex: segment?.segmentIndex ?? null,
      streetName: segment?.streetName ?? null,
      offsetM: route.offsetM,
      distanceM: route.distanceM,
    };
  }

  /** Nearest segment of one route, by distance to its road line — names the street. */
  private async findNearestSegmentOnRoute(
    routeId: number,
    latitude: number,
    longitude: number,
  ): Promise<{ segmentIndex: number; streetName: string } | undefined> {
    const [segment] = await this.dataSource.query<
      Array<{ segmentIndex: number; streetName: string }>
    >(
      `SELECT rs.segment_index AS "segmentIndex",
              rs.street_name   AS "streetName"
         FROM route_segments rs
        WHERE rs.route_id = $1
          AND rs.line IS NOT NULL
        ORDER BY ST_Distance(
                   ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                   rs.line::geography)
        LIMIT 1`,
      [routeId, longitude, latitude],
    );
    return segment;
  }

  /** Applies a collection point (or the lack of one) to a resident record. */
  private applyCollectionPoint(resident: Resident, point: ICollectionPoint | null): void {
    resident.route = point ? ({ id: point.routeId } as never) : null;
    resident.segmentIndex = point?.segmentIndex ?? null;
    resident.routeOffsetM = point?.offsetM ?? null;
    resident.distanceToRouteM = point?.distanceM ?? null;
  }

  /**
   * Admin-initiated edit (roadmap B6). The dashboard is the only edit path in
   * v1 — it is JWT-authenticated and role-guarded, so no owner token is
   * involved. Moving the pin re-runs nearest-segment assignment, otherwise the
   * resident would keep receiving alerts for the street they left.
   */
  async update(id: number, input: UpdateResidentInput): Promise<IResident> {
    const resident = await this.residentsRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);

    if (input.name !== undefined) resident.name = input.name ?? null;

    const { latitude, longitude } = input;
    // The dashboard sends the pin on every save, so only a coordinate that
    // actually differs counts as a move. Treating an unchanged pin as one would
    // re-run automatic assignment and silently discard the route the admin
    // picked in the same save.
    let moved = false;
    if (latitude !== undefined && longitude !== undefined) {
      moved = latitude !== resident.latitude || longitude !== resident.longitude;
      resident.latitude = latitude;
      resident.longitude = longitude;
    }

    if (input.routeId !== undefined) {
      // Manual assignment (E5) wins, even alongside a moved pin: the admin
      // chose the route with that pin in front of them. Not bound by the
      // walking limit — the admin may know the truck serves a house the mapped
      // route does not reach. Locked either way, so a route redraw cannot
      // quietly undo the decision.
      this.applyCollectionPoint(
        resident,
        input.routeId === null
          ? null
          : await this.pointOnRoute(input.routeId, resident.latitude, resident.longitude),
      );
      resident.routeLocked = true;
    } else if (moved) {
      // A new location is new information with no competing instruction, so
      // re-run assignment and release the lock. No route within walking
      // distance means dropping the anchor rather than leaving a stale one —
      // reassignByRoute() picks these up when coverage arrives.
      this.applyCollectionPoint(
        resident,
        await this.findCollectionPoint(resident.latitude, resident.longitude),
      );
      resident.routeLocked = false;
    }

    await this.residentsRepo.save(resident);
    // Re-read so the response carries the route and street names: the saved
    // entity holds only a partial route reference.
    return this.findOne(id);
  }

  /**
   * Re-runs automatic assignment and releases the manual lock (E5) — the
   * "Recalcular asignación" action, and the way back after an override.
   */
  async recalculateAssignment(id: number): Promise<IResident> {
    const resident = await this.residentsRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);

    this.applyCollectionPoint(
      resident,
      await this.findCollectionPoint(resident.latitude, resident.longitude),
    );
    resident.routeLocked = false;
    await this.residentsRepo.save(resident);
    return this.findOne(id);
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.residentsRepo.count({
      where: { tenantId: this.tenantContext.tenantId },
    });
    return { total };
  }

  async findAll(): Promise<IResident[]> {
    const residents = await this.residentsRepo.find({
      where: { tenantId: this.tenantContext.tenantId },
      relations: ['route'],
      order: { createdAt: 'DESC' },
    });
    // One lookup for every street name, rather than joining segments per
    // resident: routes carry few segments and the list can be long.
    const streets = await this.loadStreetNames();
    return residents.map((r) => this.toInterface(r, streets));
  }

  /** (routeId, segmentIndex) → street name, for labelling assignments (E5). */
  private async loadStreetNames(): Promise<Map<string, string>> {
    const rows = await this.dataSource.query<
      Array<{ routeId: number; segmentIndex: number; streetName: string }>
    >(
      `SELECT rs.route_id AS "routeId", rs.segment_index AS "segmentIndex",
              rs.street_name AS "streetName"
         FROM route_segments rs
         JOIN routes r ON r.id = rs.route_id
        WHERE r.tenant_id = $1`,
      [this.tenantContext.tenantId],
    );
    return new Map(rows.map((row) => [`${row.routeId}:${row.segmentIndex}`, row.streetName]));
  }

  async findOne(id: number): Promise<IResident> {
    const resident = await this.residentsRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);
    return this.toInterface(resident, await this.loadStreetNames());
  }

  /**
   * The two facts a registered device needs about its own record (C7): whether
   * it still counts as registered, and whether a route can actually reach it.
   * Null when the record no longer exists.
   */
  async findRegistrationState(
    id: number,
  ): Promise<{ isActive: boolean; routeAssigned: boolean } | null> {
    const resident = await this.residentsRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
    if (!resident) return null;
    return { isActive: resident.isActive, routeAssigned: resident.route != null };
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Resident | null> {
    return this.residentsRepo.findOne({
      where: { phoneNumber, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
  }

  /**
   * Active residents whose collection point sits within a stretch of the route
   * (B8). The engine asks by distance along the route, not by segment number,
   * because segments vary from a block to several kilometres.
   */
  async findActiveByRouteOffsetRange(
    routeId: number,
    fromOffsetM: number,
    toOffsetM: number,
  ): Promise<Resident[]> {
    return this.residentsRepo.find({
      where: {
        route: { id: routeId },
        isActive: true,
        tenantId: this.tenantContext.tenantId,
        routeOffsetM: Between(fromOffsetM, toOffsetM),
      },
    });
  }

  async deactivate(phoneNumber: string): Promise<void> {
    const resident = await this.residentsRepo.findOne({
      where: { phoneNumber, tenantId: this.tenantContext.tenantId },
    });
    if (!resident) return;
    resident.isActive = false;
    await this.residentsRepo.save(resident);
  }

  /** Admin-initiated soft deactivation ("Dar de baja") from the residents page. */
  async deactivateById(id: number): Promise<IResident> {
    const resident = await this.residentsRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);
    resident.isActive = false;
    return this.toInterface(await this.residentsRepo.save(resident));
  }

  /**
   * Re-anchors residents after a route's segments changed (the map builder's
   * "replace all segments" renumbers them, so stored values go stale). Covers
   * residents of this route plus those with no route at all, so people who
   * registered before coverage existed — or who were beyond the walking limit
   * until the route grew — finally get picked up.
   *
   * Applies exactly the same rule as findCollectionPoint(), including the
   * distance limit: a redraw that moves the road away from someone must unassign
   * them, not leave them anchored to a route they can no longer walk to.
   * Returns how many residents actually changed.
   */
  async reassignByRoute(routeId: number): Promise<number> {
    const tenantId = this.tenantContext.tenantId;
    const maxDistance = await this.systemConfigService.getMaxSnapDistanceM();

    const rows = await this.dataSource.query<Array<{ id: number }>>(
      `UPDATE residents r
          SET route_id            = sub.route_id,
              segment_index       = sub.segment_index,
              route_offset_m      = sub.offset_m,
              distance_to_route_m = sub.distance_m
         FROM (
           SELECT res.id AS resident_id,
                  CASE WHEN near.distance_m <= $3 THEN near.route_id END        AS route_id,
                  CASE WHEN near.distance_m <= $3 THEN seg.segment_index END    AS segment_index,
                  CASE WHEN near.distance_m <= $3 THEN near.offset_m END        AS offset_m,
                  CASE WHEN near.distance_m <= $3 THEN near.distance_m END      AS distance_m
             FROM residents res
             LEFT JOIN LATERAL (
               SELECT rt.id AS route_id,
                      ST_Distance(res.geom::geography, rt.centerline::geography) AS distance_m,
                      ST_LineLocatePoint(rt.centerline, res.geom) * rt.centerline_length_m AS offset_m
                 FROM routes rt
                WHERE rt.tenant_id = $2
                  AND rt.is_active = true
                  AND rt.centerline IS NOT NULL
                ORDER BY ST_Distance(res.geom::geography, rt.centerline::geography)
                LIMIT 1
             ) near ON TRUE
             LEFT JOIN LATERAL (
               SELECT rs.segment_index
                 FROM route_segments rs
                WHERE rs.route_id = near.route_id
                  AND rs.line IS NOT NULL
                ORDER BY ST_Distance(res.geom::geography, rs.line::geography)
                LIMIT 1
             ) seg ON TRUE
            WHERE res.tenant_id = $2
              AND res.route_locked = false
              AND (res.route_id = $1 OR res.route_id IS NULL)
         ) sub
        WHERE r.id = sub.resident_id
          AND (r.route_id IS DISTINCT FROM sub.route_id
               OR r.segment_index IS DISTINCT FROM sub.segment_index)
        RETURNING r.id`,
      [routeId, tenantId, maxDistance],
    );
    return rows.length;
  }

  async remove(id: number): Promise<void> {
    const resident = await this.residentsRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);
    await this.residentsRepo.remove(resident);
  }

  private toInterface(r: Resident, streets?: Map<string, string>): IResident {
    const routeId = r.route?.id ?? null;
    return {
      id: r.id,
      phoneNumber: r.phoneNumber,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      routeId,
      segmentIndex: r.segmentIndex,
      distanceToRouteM: r.distanceToRouteM,
      routeName: r.route?.name ?? null,
      streetName:
        routeId !== null && r.segmentIndex !== null
          ? (streets?.get(`${routeId}:${r.segmentIndex}`) ?? null)
          : null,
      routeLocked: r.routeLocked,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
