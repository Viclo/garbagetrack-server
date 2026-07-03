import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { CreateTenantInput } from '../dtos/inputs/create-tenant.input';
import { UpdateTenantInput } from '../dtos/inputs/update-tenant.input';

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

  async create(input: CreateTenantInput): Promise<Tenant> {
    const existing = await this.findBySlug(input.slug);
    if (existing) throw new ConflictException(`Tenant slug "${input.slug}" is already taken`);
    return this.tenantsRepo.save(
      this.tenantsRepo.create({ slug: input.slug, name: input.name, isActive: true }),
    );
  }

  async update(id: number, input: UpdateTenantInput): Promise<Tenant> {
    const tenant = await this.findById(id);
    if (!tenant) throw new NotFoundException(`Tenant with ID ${id} not found`);

    if (input.waPhoneNumberId) {
      const owner = await this.findByWaPhoneNumberId(input.waPhoneNumberId);
      if (owner && owner.id !== id)
        throw new ConflictException(
          `WhatsApp number ${input.waPhoneNumberId} already belongs to tenant "${owner.slug}"`,
        );
    }

    if (input.name !== undefined) tenant.name = input.name;
    if (input.isActive !== undefined) tenant.isActive = input.isActive;
    if (input.waPhoneNumberId !== undefined) tenant.waPhoneNumberId = input.waPhoneNumberId;
    if (input.waAccessToken !== undefined) tenant.waAccessToken = input.waAccessToken;

    return this.tenantsRepo.save(tenant);
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
