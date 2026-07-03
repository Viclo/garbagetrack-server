import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Resident } from '../entities/resident.entity';
import { INearestSegment, IResident } from '../interfaces/resident.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@Injectable()
export class ResidentsService {
  constructor(
    @InjectRepository(Resident) private readonly residentsRepo: Repository<Resident>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(
    phoneNumber: string,
    latitude: number,
    longitude: number,
    name: string | null = null,
  ): Promise<Resident> {
    const tenantId = this.tenantContext.tenantId;

    // Find nearest active route segment of THIS tenant using PostGIS KNN operator
    const [nearest] = await this.dataSource.query<INearestSegment[]>(
      `SELECT rs.route_id   AS "routeId",
              rs.segment_index AS "segmentIndex",
              rs.street_name   AS "streetName"
       FROM route_segments rs
       JOIN routes r ON r.id = rs.route_id
       WHERE r.is_active = true
         AND r.tenant_id = $3
       ORDER BY rs.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
       LIMIT 1`,
      [longitude, latitude, tenantId],
    );

    const existing = await this.residentsRepo.findOne({ where: { phoneNumber, tenantId } });
    if (existing) {
      existing.latitude = latitude;
      existing.longitude = longitude;
      existing.route = nearest ? ({ id: nearest.routeId } as never) : null;
      existing.segmentIndex = nearest?.segmentIndex ?? null;
      existing.isActive = true;
      // Refresh the name on re-registration, but never erase one we already have.
      if (name) existing.name = name;
      return this.residentsRepo.save(existing);
    }

    const resident = this.residentsRepo.create({
      phoneNumber,
      name,
      latitude,
      longitude,
      route: nearest ? ({ id: nearest.routeId } as never) : null,
      segmentIndex: nearest?.segmentIndex ?? null,
      tenantId,
    });
    return this.residentsRepo.save(resident);
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
    return residents.map((r) => this.toInterface(r));
  }

  async findOne(id: number): Promise<IResident> {
    const resident = await this.residentsRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);
    return this.toInterface(resident);
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Resident | null> {
    return this.residentsRepo.findOne({
      where: { phoneNumber, tenantId: this.tenantContext.tenantId },
      relations: ['route'],
    });
  }

  async findActiveByRouteAndSegment(routeId: number, segmentIndex: number): Promise<Resident[]> {
    return this.residentsRepo.find({
      where: {
        route: { id: routeId },
        segmentIndex,
        isActive: true,
        tenantId: this.tenantContext.tenantId,
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
   * "replace all segments" renumbers them, so stored segment_index values go
   * stale). Re-runs the same nearest-active-segment assignment used at
   * registration for every resident of the route — plus residents that had no
   * route at all, so people who registered before coverage existed finally get
   * picked up. Returns how many residents actually changed assignment.
   */
  async reassignByRoute(routeId: number): Promise<number> {
    const tenantId = this.tenantContext.tenantId;
    const rows = await this.dataSource.query<Array<{ id: number }>>(
      `UPDATE residents r
       SET route_id      = sub."routeId",
           segment_index = sub."segmentIndex"
       FROM (
         SELECT res.id AS resident_id,
                nearest."routeId",
                nearest."segmentIndex"
         FROM residents res
         CROSS JOIN LATERAL (
           SELECT rs.route_id      AS "routeId",
                  rs.segment_index AS "segmentIndex"
           FROM route_segments rs
           JOIN routes rt ON rt.id = rs.route_id
           WHERE rt.is_active = true
             AND rt.tenant_id = $2
           ORDER BY rs.geom <-> ST_SetSRID(ST_MakePoint(res.longitude, res.latitude), 4326)
           LIMIT 1
         ) nearest
         WHERE res.tenant_id = $2
           AND (res.route_id = $1 OR res.route_id IS NULL)
       ) sub
       WHERE r.id = sub.resident_id
         AND (r.route_id IS DISTINCT FROM sub."routeId"
              OR r.segment_index IS DISTINCT FROM sub."segmentIndex")
       RETURNING r.id`,
      [routeId, tenantId],
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

  private toInterface(r: Resident): IResident {
    return {
      id: r.id,
      phoneNumber: r.phoneNumber,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      routeId: r.route?.id ?? null,
      segmentIndex: r.segmentIndex,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
