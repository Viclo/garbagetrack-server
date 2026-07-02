import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { Truck } from '../../trucks/entities/truck.entity';
import { Route } from '../../routes/entities/route.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * A single driving session: from when a driver taps "Iniciar Ruta" until they
 * stop (or the session is auto-closed after inactivity). Duration is wall-clock
 * `endedAt - startedAt` and includes short offline gaps. An open session has
 * `endedAt = null`.
 */
@Entity('route_sessions')
export class RouteSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @ManyToOne(() => Driver, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @ManyToOne(() => Truck, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'truck_id' })
  truck!: Truck | null;

  @ManyToOne(() => Route, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'route_id' })
  route!: Route | null;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Index()
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt!: Date;
}
