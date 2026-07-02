import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../entities/system-config.entity';
import { ISystemConfig } from '../interfaces/system-config.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

/** Keys every tenant gets; created lazily the first time a tenant reads its config. */
const DEFAULTS: Array<{ key: string; value: string }> = [
  { key: 'notification_blocks', value: '1' },
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
