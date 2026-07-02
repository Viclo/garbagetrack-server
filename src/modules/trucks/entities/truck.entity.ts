import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Driver } from '../../drivers/entities/driver.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('trucks')
@Unique(['tenantId', 'name'])
@Unique(['tenantId', 'licensePlate'])
export class Truck {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @Column()
  name!: string;

  @Column({ name: 'license_plate' })
  licensePlate!: string;

  @ManyToOne(() => Driver, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
