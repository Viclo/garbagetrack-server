import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from '../entities/admin.entity';
import { CreateAdminInput } from '../dtos/inputs/create-admin.input';
import { UpdateAdminInput } from '../dtos/inputs/update-admin.input';
import { IAdmin, IAdminWithPassword } from '../interfaces/admin.interface';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
  ) {}

  async create(input: CreateAdminInput): Promise<IAdmin> {
    const existing = await this.adminsRepository.findOne({ where: { username: input.username } });
    if (existing) throw new ConflictException(`Username "${input.username}" is already taken`);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const admin = this.adminsRepository.create({
      username: input.username,
      passwordHash,
      name: input.name,
    });
    return this.adminsRepository.save(admin);
  }

  async findAll(): Promise<IAdmin[]> {
    return this.adminsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<IAdmin> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);
    return admin;
  }

  async findByUsername(username: string): Promise<IAdminWithPassword | null> {
    return this.adminsRepository.findOne({ where: { username } });
  }

  async update(id: number, input: UpdateAdminInput): Promise<IAdmin> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);

    if (input.password) {
      admin.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }
    if (input.name !== undefined) admin.name = input.name;
    if (input.isActive !== undefined) admin.isActive = input.isActive;

    return this.adminsRepository.save(admin);
  }

  async remove(id: number): Promise<void> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);
    await this.adminsRepository.remove(admin);
  }
}
