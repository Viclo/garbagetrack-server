import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { RouteSegment } from './route-segment.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('routes')
@Unique(['tenantId', 'name'])
export class Route {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null = null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => RouteSegment, (segment) => segment.route, { cascade: true })
  segments!: RouteSegment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
