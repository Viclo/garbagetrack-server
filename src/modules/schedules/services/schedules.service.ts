import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeeklySchedule } from '../entities/weekly-schedule.entity';
import { Truck } from '../../trucks/entities/truck.entity';
import { Route } from '../../routes/entities/route.entity';
import { UpsertScheduleInput } from '../dtos/inputs/upsert-schedule.input';
import { IWeeklySchedule } from '../interfaces/schedule.interface';
import { DayOfWeek } from '../../../common/enums/day-of-week.enum';
import { TenantContextService } from '../../../common/context/tenant-context.service';

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  1: DayOfWeek.MON,
  2: DayOfWeek.TUE,
  3: DayOfWeek.WED,
  4: DayOfWeek.THU,
  5: DayOfWeek.FRI,
};

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(WeeklySchedule) private readonly schedulesRepo: Repository<WeeklySchedule>,
    @InjectRepository(Truck) private readonly trucksRepo: Repository<Truck>,
    @InjectRepository(Route) private readonly routesRepo: Repository<Route>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async upsert(input: UpsertScheduleInput): Promise<IWeeklySchedule> {
    const tenantId = this.tenantContext.tenantId;

    const truck = await this.trucksRepo.findOne({ where: { id: input.truckId, tenantId } });
    if (!truck) throw new NotFoundException(`Truck with ID ${input.truckId} not found`);

    const route = await this.routesRepo.findOne({ where: { id: input.routeId, tenantId } });
    if (!route) throw new NotFoundException(`Route with ID ${input.routeId} not found`);

    const existing = await this.schedulesRepo.findOne({
      where: { truck: { id: input.truckId }, dayOfWeek: input.dayOfWeek, tenantId },
    });

    if (existing) {
      existing.route = route;
      return this.schedulesRepo.save(existing);
    }

    const schedule = this.schedulesRepo.create({
      truck,
      route,
      dayOfWeek: input.dayOfWeek,
      tenantId,
    });
    return this.schedulesRepo.save(schedule);
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
    const dayIndex = new Date().getDay();
    const dayOfWeek = JS_DAY_TO_ENUM[dayIndex];
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
