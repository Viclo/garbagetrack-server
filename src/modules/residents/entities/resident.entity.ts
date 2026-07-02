import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Unique,
} from 'typeorm';
import { Route } from '../../routes/entities/route.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('residents')
@Unique(['tenantId', 'phoneNumber'])
export class Resident {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @Column({ name: 'phone_number' })
  phoneNumber!: string;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  geom!: string | null;

  @ManyToOne(() => Route, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_id' })
  route!: Route | null;

  @Column({ name: 'segment_index', nullable: true, type: 'int' })
  segmentIndex!: number | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  setGeom(): void {
    // TypeORM wraps geometry values with ST_GeomFromGeoJSON, so the value must be
    // a GeoJSON object — not WKT. TypeORM JSON.stringifies the object before binding.
    if (this.latitude != null && this.longitude != null) {
      (this as unknown as { geom: object }).geom = {
        type: 'Point',
        coordinates: [this.longitude, this.latitude],
      };
    }
  }
}
