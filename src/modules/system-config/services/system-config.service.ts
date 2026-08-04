import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../entities/system-config.entity';
import { ISystemConfig } from '../interfaces/system-config.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

/** Keys every tenant gets; created lazily the first time a tenant reads its config. */
const DEFAULTS: Array<{ key: string; value: string }> = [
  { key: 'notification_blocks', value: '1' },
  // B7/B8. How far a resident may be from the route and still be served: past
  // this they are told they are outside the collection zone, because nobody
  // carries a bag further. The lead time is what the alert aims for; the speed
  // is the bootstrap for estimating it until a route has history.
  { key: 'max_snap_distance_m', value: '200' },
  { key: 'notify_lead_minutes', value: '20' },
  { key: 'avg_truck_speed_kmh', value: '8' },
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

  async getNotificationBlocks(): Promise<number> {
    const value = await this.get('notification_blocks');
    return parseInt(value ?? '1', 10);
  }

  /** Metres a resident may be from a route and still be assigned to it (B7). */
  async getMaxSnapDistanceM(): Promise<number> {
    const parsed = Number(await this.get('max_snap_distance_m'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
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
