import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from '../entities/admin.entity';
import { CreateAdminInput } from '../dtos/inputs/create-admin.input';
import { UpdateAdminInput } from '../dtos/inputs/update-admin.input';
import { IAdmin, IAdminWithPassword } from '../interfaces/admin.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { UserRole } from '../../../common/enums/user-role.enum';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(input: CreateAdminInput, role: UserRole = UserRole.ADMIN): Promise<IAdmin> {
    const existing = await this.adminsRepository.findOne({ where: { username: input.username } });
    if (existing) throw new ConflictException(`Username "${input.username}" is already taken`);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const admin = this.adminsRepository.create({
      username: input.username,
      passwordHash,
      name: input.name,
      role,
      tenantId: this.tenantContext.tenantId,
    });
    return this.toInterface(await this.adminsRepository.save(admin));
  }

  async findAll(): Promise<IAdmin[]> {
    const admins = await this.adminsRepository.find({
      where: { tenantId: this.tenantContext.tenantId },
      order: { createdAt: 'DESC' },
    });
    return admins.map((a) => this.toInterface(a));
  }

  async findOne(id: number): Promise<IAdmin> {
    const admin = await this.adminsRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);
    return this.toInterface(admin);
  }

  /** Unscoped: used by login, which resolves the tenant FROM the matched user. */
  async findByUsername(username: string): Promise<IAdminWithPassword | null> {
    return this.adminsRepository.findOne({ where: { username } });
  }

  /**
   * Unscoped: used by per-request token re-validation, which runs BEFORE the
   * tenant context is opened. Never expose through a controller.
   */
  async findByIdForAuth(id: number): Promise<Admin | null> {
    return this.adminsRepository.findOne({ where: { id } });
  }

  async update(id: number, input: UpdateAdminInput, actingAdminId?: number): Promise<IAdmin> {
    const admin = await this.adminsRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);

    if (input.isActive === false) {
      if (id === actingAdminId) {
        throw new ConflictException('No puedes desactivar tu propia cuenta.');
      }
      await this.assertNotLastActiveAdmin(id);
    }

    if (input.password) {
      admin.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }
    if (input.name !== undefined) admin.name = input.name;
    if (input.isActive !== undefined) admin.isActive = input.isActive;

    return this.toInterface(await this.adminsRepository.save(admin));
  }

  async remove(id: number, actingAdminId?: number): Promise<void> {
    const admin = await this.adminsRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);
    if (id === actingAdminId) {
      throw new ConflictException('No puedes eliminar tu propia cuenta.');
    }
    await this.assertNotLastActiveAdmin(id);
    await this.adminsRepository.remove(admin);
  }

  /**
   * A municipality with no active administrator cannot get one back — nothing
   * in the product creates the first admin, and the seed only runs on an empty
   * database. So the last one standing is not removable, even deliberately.
   */
  private async assertNotLastActiveAdmin(id: number): Promise<void> {
    const remaining = await this.adminsRepository.count({
      where: { tenantId: this.tenantContext.tenantId, isActive: true, id: Not(id) },
    });
    if (remaining === 0) {
      throw new ConflictException(
        'Debe quedar al menos un administrador activo en el municipio.',
      );
    }
  }

  /** Public shape: never let passwordHash leave the service. */
  private toInterface(admin: Admin): IAdmin {
    return {
      id: admin.id,
      tenantId: admin.tenantId,
      username: admin.username,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
