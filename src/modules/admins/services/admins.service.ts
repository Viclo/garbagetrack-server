import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from '../entities/admin.entity';
import { CreateAdminInput } from '../dtos/inputs/create-admin.input';
import { UpdateAdminInput } from '../dtos/inputs/update-admin.input';
import { IAdmin, IAdminWithPassword } from '../interfaces/admin.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(input: CreateAdminInput): Promise<IAdmin> {
    // Username is globally unique (login has no tenant selector).
    const existing = await this.adminsRepository.findOne({ where: { username: input.username } });
    if (existing) throw new ConflictException(`Username "${input.username}" is already taken`);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const admin = this.adminsRepository.create({
      username: input.username,
      passwordHash,
      name: input.name,
      tenantId: this.tenantContext.tenantId,
    });
    return this.adminsRepository.save(admin);
  }

  async findAll(): Promise<IAdmin[]> {
    return this.adminsRepository.find({
      where: { tenantId: this.tenantContext.tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<IAdmin> {
    const admin = await this.adminsRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);
    return admin;
  }

  /** Unscoped: used by login, which resolves the tenant FROM the matched user. */
  async findByUsername(username: string): Promise<IAdminWithPassword | null> {
    return this.adminsRepository.findOne({ where: { username } });
  }

  async update(id: number, input: UpdateAdminInput): Promise<IAdmin> {
    const admin = await this.adminsRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);

    if (input.password) {
      admin.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }
    if (input.name !== undefined) admin.name = input.name;
    if (input.isActive !== undefined) admin.isActive = input.isActive;

    return this.adminsRepository.save(admin);
  }

  async remove(id: number): Promise<void> {
    const admin = await this.adminsRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);
    await this.adminsRepository.remove(admin);
  }
}
