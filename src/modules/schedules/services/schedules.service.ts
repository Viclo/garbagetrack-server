import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeeklySchedule } from '../entities/weekly-schedule.entity';
import { Truck } from '../../trucks/entities/truck.entity';
import { Route } from '../../routes/entities/route.entity';
import { UpsertScheduleInput } from '../dtos/inputs/upsert-schedule.input';
import { IWeeklySchedule } from '../interfaces/schedule.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { DAY_LABELS_ES, localDayOfWeek } from '../../../common/utils/local-time.util';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(WeeklySchedule) private readonly schedulesRepo: Repository<WeeklySchedule>,
    @InjectRepository(Truck) private readonly trucksRepo: Repository<Truck>,
    @InjectRepository(Route) private readonly routesRepo: Repository<Route>,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Create one day's assignment, or move an existing one when `id` is given.
   *
   * Both halves of the pairing are exclusive for a day: a truck can only be on
   * one route at a time, and a route needs exactly one truck so the residents
   * watching it are told about one vehicle. Silently overwriting a conflicting
   * row (what this used to do) meant an admin could wipe Tuesday's assignment
   * by re-adding the same truck and never see it happen.
   */
  async upsert(input: UpsertScheduleInput, id?: number): Promise<IWeeklySchedule> {
    const tenantId = this.tenantContext.tenantId;

    const truck = await this.trucksRepo.findOne({ where: { id: input.truckId, tenantId } });
    if (!truck) throw new NotFoundException(`Truck with ID ${input.truckId} not found`);
    if (!truck.isActive) {
      throw new ConflictException(
        `El camión ${truck.licensePlate} está inactivo y no puede recibir horarios.`,
      );
    }

    const route = await this.routesRepo.findOne({ where: { id: input.routeId, tenantId } });
    if (!route) throw new NotFoundException(`Route with ID ${input.routeId} not found`);
    if (!route.isActive) {
      throw new ConflictException(
        `La ruta "${route.name}" está inactiva y no puede asignarse a un horario.`,
      );
    }

    const target = id ? await this.findOneOrFail(id) : null;

    const dayLabel = DAY_LABELS_ES[input.dayOfWeek];
    const clashes = await this.schedulesRepo.find({
      where: [
        { truck: { id: input.truckId }, dayOfWeek: input.dayOfWeek, tenantId },
        { route: { id: input.routeId }, dayOfWeek: input.dayOfWeek, tenantId },
      ],
      relations: ['truck', 'route'],
    });

    for (const clash of clashes) {
      if (target && clash.id === target.id) continue;
      if (clash.truck.id === input.truckId) {
        throw new ConflictException(
          `El camión ${truck.licensePlate} ya tiene asignada la ruta "${clash.route.name}" el ${dayLabel}.`,
        );
      }
      throw new ConflictException(
        `La ruta "${route.name}" ya está asignada al camión ${clash.truck.licensePlate} el ${dayLabel}.`,
      );
    }

    const schedule =
      target ??
      this.schedulesRepo.create({
        tenantId,
      });
    schedule.truck = truck;
    schedule.route = route;
    schedule.dayOfWeek = input.dayOfWeek;
    return this.schedulesRepo.save(schedule);
  }

  private async findOneOrFail(id: number): Promise<WeeklySchedule> {
    const schedule = await this.schedulesRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
      relations: ['truck', 'route'],
    });
    if (!schedule) throw new NotFoundException(`Schedule with ID ${id} not found`);
    return schedule;
  }

  async findAll(): Promise<IWeeklySchedule[]> {
    return this.schedulesRepo.find({
      where: { tenantId: this.tenantContext.tenantId },
      relations: ['truck', 'truck.driver', 'route'],
      order: { truck: { name: 'ASC' }, dayOfWeek: 'ASC' } as never,
    });
  }

  async findByTruck(truckId: number): Promise<IWeeklySchedule[]> {
    return this.schedulesRepo.find({
      where: { truck: { id: truckId }, tenantId: this.tenantContext.tenantId },
      relations: ['truck', 'route'],
    });
  }

  async findForToday(truckId: number): Promise<WeeklySchedule | null> {
    const dayOfWeek = localDayOfWeek();
    if (!dayOfWeek) return null;

    return this.schedulesRepo.findOne({
      where: { truck: { id: truckId }, dayOfWeek, tenantId: this.tenantContext.tenantId },
      relations: ['truck', 'route', 'route.segments'],
    });
  }

  async remove(id: number): Promise<void> {
    const schedule = await this.schedulesRepo.findOne({
      where: { id, tenantId: this.tenantContext.tenantId },
    });
    if (!schedule) throw new NotFoundException(`Schedule with ID ${id} not found`);
    await this.schedulesRepo.remove(schedule);
  }
}
