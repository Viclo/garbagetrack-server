import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Driver } from '../entities/driver.entity';
import { CreateDriverInput } from '../dtos/inputs/create-driver.input';
import { UpdateDriverInput } from '../dtos/inputs/update-driver.input';
import { IDriver, IDriverWithPassword } from '../interfaces/driver.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(input: CreateDriverInput): Promise<IDriver> {
    // Username is globally unique (login has no tenant selector).
    const existing = await this.driversRepository.findOne({ where: { username: input.username } });
    if (existing) throw new ConflictException(`Username "${input.username}" is already taken`);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const driver = this.driversRepository.create({
      username: input.username,
      passwordHash,
      name: input.name,
      phone: input.phone ?? null,
      licenseNumber: input.licenseNumber ?? null,
      licenseExpiresAt: input.licenseExpiresAt ?? null,
      tenantId: this.tenantContext.tenantId,
    });
    return this.toInterface(await this.driversRepository.save(driver));
  }

  async findAll(): Promise<IDriver[]> {
    const drivers = await this.driversRepository.find({
      where: { tenantId: this.tenantContext.tenantId },
      order: { createdAt: 'DESC' },
    });
    return drivers.map((driver) => this.toInterface(driver));
  }

  async findOne(id: number): Promise<IDriver> {
    const driver = await this.driversRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!driver) throw new NotFoundException(`Driver with ID ${id} not found`);
    return this.toInterface(driver);
  }

  /** Unscoped: used by login, which resolves the tenant FROM the matched user. */
  async findByUsername(username: string): Promise<IDriverWithPassword | null> {
    return this.driversRepository.findOne({ where: { username } });
  }

  /**
   * Unscoped: used by per-request token re-validation, which runs BEFORE the
   * tenant context is opened. Never expose through a controller.
   */
  async findByIdForAuth(id: number): Promise<Driver | null> {
    return this.driversRepository.findOne({ where: { id } });
  }

  async update(id: number, input: UpdateDriverInput): Promise<IDriver> {
    const driver = await this.driversRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!driver) throw new NotFoundException(`Driver with ID ${id} not found`);

    if (input.password) {
      driver.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }
    if (input.name !== undefined) driver.name = input.name;
    if (input.phone !== undefined) driver.phone = input.phone;
    if (input.licenseNumber !== undefined) driver.licenseNumber = input.licenseNumber;
    if (input.licenseExpiresAt !== undefined) driver.licenseExpiresAt = input.licenseExpiresAt;
    if (input.isActive !== undefined) driver.isActive = input.isActive;

    return this.toInterface(await this.driversRepository.save(driver));
  }

  async remove(id: number): Promise<void> {
    const driver = await this.driversRepository.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!driver) throw new NotFoundException(`Driver with ID ${id} not found`);
    await this.driversRepository.remove(driver);
  }

  /**
   * Public shape: never let passwordHash leave the service.
   *
   * These methods used to return the entity straight from the repository, so
   * GET /drivers handed every driver's bcrypt hash to the admin browser — the
   * IDriver return type says otherwise, but TypeScript cannot strip fields at
   * runtime. Mirrors AdminsService.toInterface.
   */
  private toInterface(driver: Driver): IDriver {
    return {
      id: driver.id,
      tenantId: driver.tenantId,
      username: driver.username,
      name: driver.name,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      licenseExpiresAt: driver.licenseExpiresAt,
      isActive: driver.isActive,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }
}
