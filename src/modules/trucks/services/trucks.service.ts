import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Truck } from '../entities/truck.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { CreateTruckInput } from '../dtos/inputs/create-truck.input';
import { UpdateTruckInput } from '../dtos/inputs/update-truck.input';
import { ITruck } from '../interfaces/truck.interface';

@Injectable()
export class TrucksService {
  constructor(
    @InjectRepository(Truck) private readonly trucksRepo: Repository<Truck>,
    @InjectRepository(Driver) private readonly driversRepo: Repository<Driver>,
  ) {}

  async create(input: CreateTruckInput): Promise<ITruck> {
    const existingName = await this.trucksRepo.findOne({ where: { name: input.name } });
    if (existingName) throw new ConflictException(`Truck name "${input.name}" is already taken`);

    const existingPlate = await this.trucksRepo.findOne({
      where: { licensePlate: input.licensePlate },
    });
    if (existingPlate)
      throw new ConflictException(`License plate "${input.licensePlate}" is already registered`);

    let driver: Driver | null = null;
    if (input.driverId != null) {
      driver = await this.resolveDriver(input.driverId);
    }

    const truck = this.trucksRepo.create({
      name: input.name,
      licensePlate: input.licensePlate,
      driver,
    });
    return this.trucksRepo.save(truck);
  }

  async findAll(): Promise<ITruck[]> {
    return this.trucksRepo.find({ relations: ['driver'], order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<ITruck> {
    const truck = await this.trucksRepo.findOne({ where: { id }, relations: ['driver'] });
    if (!truck) throw new NotFoundException(`Truck with ID ${id} not found`);
    return truck;
  }

  async getStats(): Promise<{ total: number; active: number }> {
    const [total, active] = await Promise.all([
      this.trucksRepo.count(),
      this.trucksRepo.count({ where: { isActive: true } }),
    ]);
    return { total, active };
  }

  async findByDriverId(driverId: number): Promise<Truck | null> {
    return this.trucksRepo.findOne({
      where: { driver: { id: driverId }, isActive: true },
      relations: ['driver'],
    });
  }

  async update(id: number, input: UpdateTruckInput): Promise<ITruck> {
    const truck = await this.trucksRepo.findOne({ where: { id }, relations: ['driver'] });
    if (!truck) throw new NotFoundException(`Truck with ID ${id} not found`);

    if (input.name !== undefined) truck.name = input.name;
    if (input.licensePlate !== undefined) truck.licensePlate = input.licensePlate;
    if (input.isActive !== undefined) truck.isActive = input.isActive;

    if ('driverId' in input) {
      truck.driver = input.driverId != null ? await this.resolveDriver(input.driverId) : null;
    }

    return this.trucksRepo.save(truck);
  }

  async remove(id: number): Promise<void> {
    const truck = await this.trucksRepo.findOne({ where: { id } });
    if (!truck) throw new NotFoundException(`Truck with ID ${id} not found`);
    await this.trucksRepo.remove(truck);
  }

  private async resolveDriver(driverId: number): Promise<Driver> {
    const driver = await this.driversRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException(`Driver with ID ${driverId} not found`);
    if (!driver.isActive) throw new BadRequestException(`Driver ${driverId} is not active`);
    return driver;
  }
}
