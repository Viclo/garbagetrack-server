import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Truck } from '../../trucks/entities/truck.entity';
import { Route } from '../../routes/entities/route.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { DayOfWeek } from '../../../common/enums/day-of-week.enum';

@Entity('weekly_schedules')
@Unique(['truck', 'dayOfWeek'])
export class WeeklySchedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @ManyToOne(() => Truck, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'truck_id' })
  truck!: Truck;

  @ManyToOne(() => Route, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route!: Route;

  @Column({ type: 'enum', enum: DayOfWeek, name: 'day_of_week' })
  dayOfWeek!: DayOfWeek;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
