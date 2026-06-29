import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../entities/system-config.entity';
import { ISystemConfig } from '../interfaces/system-config.interface';

const DEFAULTS: Array<{ key: string; value: string }> = [
  { key: 'notification_blocks', value: '1' },
];

@Injectable()
export class SystemConfigService implements OnModuleInit {
  constructor(@InjectRepository(SystemConfig) private readonly repo: Repository<SystemConfig>) {}

  async onModuleInit(): Promise<void> {
    for (const item of DEFAULTS) {
      const exists = await this.repo.findOne({ where: { key: item.key } });
      if (!exists) await this.repo.save(item);
    }
  }

  async findAll(): Promise<ISystemConfig[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async get(key: string): Promise<string | null> {
    const config = await this.repo.findOne({ where: { key } });
    return config?.value ?? null;
  }

  async getNotificationBlocks(): Promise<number> {
    const value = await this.get('notification_blocks');
    return parseInt(value ?? '1', 10);
  }

  async set(key: string, value: string): Promise<ISystemConfig> {
    const config = await this.repo.findOne({ where: { key } });
    if (!config) throw new NotFoundException(`Config key "${key}" not found`);
    config.value = value;
    return this.repo.save(config);
  }
}
