import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../entities/system-config.entity';
import { ISystemConfig } from '../interfaces/system-config.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

/** Keys every tenant gets; created lazily the first time a tenant reads its config. */
const DEFAULTS: Array<{ key: string; value: string }> = [
  // B7/B8. How far a resident may be from the route and still be served: past
  // this they are outside the collection zone, because nobody carries a bag
  // further. The lead time is what the first alert aims for; the speed is the
  // bootstrap for estimating it until a truck has moved enough to measure.
  // Arrival distance is how close counts as "the truck is on your street".
  { key: 'max_snap_distance_m', value: '200' },
  { key: 'notify_lead_minutes', value: '20' },
  { key: 'avg_truck_speed_kmh', value: '8' },
  { key: 'arrival_distance_m', value: '150' },
  // Shown to residents on the public registration page so they know who to call
  // about a missed pickup or a wrong address. Empty until the admin fills it in,
  // in which case the page simply omits the line.
  { key: 'contact_phone', value: '' },
];

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectRepository(SystemConfig) private readonly repo: Repository<SystemConfig>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(): Promise<ISystemConfig[]> {
    const tenantId = this.tenantContext.tenantId;
    await this.ensureDefaults(tenantId);
    return this.repo.find({ where: { tenantId }, order: { key: 'ASC' } });
  }

  async get(key: string): Promise<string | null> {
    const config = await this.repo.findOne({
      where: { key, tenantId: this.tenantContext.tenantId },
    });
    if (config) return config.value;
    return DEFAULTS.find((d) => d.key === key)?.value ?? null;
  }

  /** Metres a resident may be from a route and still be assigned to it (B7). */
  async getMaxSnapDistanceM(): Promise<number> {
    return this.getPositiveNumber('max_snap_distance_m', 200);
  }

  /** How much warning the first alert aims to give, in minutes (B8). */
  async getNotifyLeadMinutes(): Promise<number> {
    return this.getPositiveNumber('notify_lead_minutes', 20);
  }

  /** Fallback pace when the truck has not moved enough to measure one (B8). */
  async getAvgTruckSpeedKmh(): Promise<number> {
    return this.getPositiveNumber('avg_truck_speed_kmh', 8);
  }

  /** How close along the route counts as "the truck is on your street" (B8). */
  async getArrivalDistanceM(): Promise<number> {
    return this.getPositiveNumber('arrival_distance_m', 150);
  }

  /** A misconfigured value must not disable alerts, so fall back to the default. */
  private async getPositiveNumber(key: string, fallback: number): Promise<number> {
    const parsed = Number(await this.get(key));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  async set(key: string, value: string): Promise<ISystemConfig> {
    const tenantId = this.tenantContext.tenantId;
    const config = await this.repo.findOne({ where: { key, tenantId } });
    if (config) {
      config.value = value;
      return this.repo.save(config);
    }
    // Known keys are upserted so a tenant that never read defaults can still write.
    if (!DEFAULTS.some((d) => d.key === key)) {
      throw new NotFoundException(`Config key "${key}" not found`);
    }
    return this.repo.save(this.repo.create({ key, value, tenantId }));
  }

  private async ensureDefaults(tenantId: number): Promise<void> {
    for (const item of DEFAULTS) {
      const exists = await this.repo.findOne({ where: { key: item.key, tenantId } });
      if (!exists) await this.repo.save(this.repo.create({ ...item, tenantId }));
    }
  }
}
