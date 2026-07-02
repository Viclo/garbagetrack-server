import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Truck } from '../../trucks/entities/truck.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('truck_positions')
export class TruckPosition {
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

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ name: 'current_segment_index', nullable: true, type: 'int' })
  currentSegmentIndex!: number | null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;
}
