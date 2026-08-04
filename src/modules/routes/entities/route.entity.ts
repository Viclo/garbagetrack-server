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
  Index,
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

  /**
   * All segments chained in order — the line a truck actually drives (B7).
   * Rebuilt by RoutesService whenever segments change; residents anchor to a
   * point on it and their distance along it drives the proximity engine.
   */
  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'LineString', srid: 4326, nullable: true })
  centerline!: string | null;

  @Column({ name: 'centerline_length_m', type: 'double precision', nullable: true })
  centerlineLengthM!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
