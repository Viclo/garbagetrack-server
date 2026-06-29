import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Resident } from '../entities/resident.entity';
import { IResident } from '../interfaces/resident.interface';

interface INearestSegment {
  routeId: number;
  segmentIndex: number;
  streetName: string;
}

@Injectable()
export class ResidentsService {
  constructor(
    @InjectRepository(Resident) private readonly residentsRepo: Repository<Resident>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(phoneNumber: string, latitude: number, longitude: number): Promise<Resident> {
    // Find nearest active route segment using PostGIS KNN operator
    const [nearest] = await this.dataSource.query<INearestSegment[]>(
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

    const existing = await this.residentsRepo.findOne({ where: { phoneNumber } });
    if (existing) {
      existing.latitude = latitude;
      existing.longitude = longitude;
      existing.route = nearest ? ({ id: nearest.routeId } as never) : null;
      existing.segmentIndex = nearest?.segmentIndex ?? null;
      existing.isActive = true;
      return this.residentsRepo.save(existing);
    }

    const resident = this.residentsRepo.create({
      phoneNumber,
      latitude,
      longitude,
      route: nearest ? ({ id: nearest.routeId } as never) : null,
      segmentIndex: nearest?.segmentIndex ?? null,
    });
    return this.residentsRepo.save(resident);
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.residentsRepo.count();
    return { total };
  }

  async findAll(): Promise<IResident[]> {
    const residents = await this.residentsRepo.find({
      relations: ['route'],
      order: { createdAt: 'DESC' },
    });
    return residents.map((r) => this.toInterface(r));
  }

  async findOne(id: number): Promise<IResident> {
    const resident = await this.residentsRepo.findOne({ where: { id }, relations: ['route'] });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);
    return this.toInterface(resident);
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Resident | null> {
    return this.residentsRepo.findOne({ where: { phoneNumber }, relations: ['route'] });
  }

  async findActiveByRouteAndSegment(routeId: number, segmentIndex: number): Promise<Resident[]> {
    return this.residentsRepo.find({
      where: { route: { id: routeId }, segmentIndex, isActive: true },
    });
  }

  async deactivate(phoneNumber: string): Promise<void> {
    const resident = await this.residentsRepo.findOne({ where: { phoneNumber } });
    if (!resident) return;
    resident.isActive = false;
    await this.residentsRepo.save(resident);
  }

  async remove(id: number): Promise<void> {
    const resident = await this.residentsRepo.findOne({ where: { id } });
    if (!resident) throw new NotFoundException(`Resident with ID ${id} not found`);
    await this.residentsRepo.remove(resident);
  }

  private toInterface(r: Resident): IResident {
    return {
      id: r.id,
      phoneNumber: r.phoneNumber,
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
