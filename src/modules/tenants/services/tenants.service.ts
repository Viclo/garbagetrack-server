import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

export const DEFAULT_TENANT_SLUG = 'default';

@Injectable()
export class TenantsService {
  constructor(@InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>) {}

  async findById(id: number): Promise<Tenant | null> {
    return this.tenantsRepo.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantsRepo.findOne({ where: { slug } });
  }

  /** Maps an incoming Meta webhook to a municipality by its business phone_number_id. */
  async findByWaPhoneNumberId(waPhoneNumberId: string): Promise<Tenant | null> {
    return this.tenantsRepo.findOne({ where: { waPhoneNumberId } });
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepo.find({ order: { name: 'ASC' } });
  }

  /**
   * The bootstrap tenant every pre-multi-tenant row belongs to. Created on
   * demand so the seed and a fresh deployment both converge to the same state.
   */
  async ensureDefault(name = 'GarbageTrack'): Promise<Tenant> {
    const existing = await this.findBySlug(DEFAULT_TENANT_SLUG);
    if (existing) return existing;
    return this.tenantsRepo.save(
      this.tenantsRepo.create({ slug: DEFAULT_TENANT_SLUG, name, isActive: true }),
    );
  }
}
