import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Truck } from '../../trucks/entities/truck.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { RouteSession } from './route-session.entity';

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

  /**
   * The run this fix was sent under. A truck can carry two runs in one day (a
   * reopened route, a replacement), so grouping by truck and time alone cannot
   * tell them apart; the archiver moves exactly these fixes into route_tracks.
   * Null on fixes stored before this column existed. Writers set the plain
   * `routeSessionId` below; the relation exists so the foreign key is part of
   * the entity and `migration:generate` does not try to drop it.
   *
   * SET NULL, not CASCADE: deleting a driver cascades to their sessions, and
   * that must not erase fixes the archiver has not moved into history yet.
   */
  @ManyToOne(() => RouteSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_session_id' })
  routeSession!: RouteSession | null;

  @Index('IDX_truck_positions_route_session')
  @Column({ name: 'route_session_id', type: 'int', nullable: true })
  routeSessionId!: number | null;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ name: 'current_segment_index', nullable: true, type: 'int' })
  currentSegmentIndex!: number | null;

  /** When the server stored the fix. */
  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;

  /**
   * When the DEVICE took the fix (D6). The driver app batches after a signal
   * gap, so received time can lag by minutes; every ETA must be computed from
   * this, or a stale fix promises warning the resident does not have. Falls
   * back to the received time when the app sends no timestamp.
   */
  @Column({ name: 'recorded_at', type: 'timestamptz', nullable: true })
  recordedAt!: Date | null;

  /**
   * The fix projected onto the route's centerline (B8): how far along the route
   * the truck is, and how far it strayed from it. Computed once at ingest
   * because the engine reads recent fixes on every update to derive speed and
   * direction. Null when the route has no centerline yet.
   */
  @Column({ name: 'route_offset_m', type: 'double precision', nullable: true })
  routeOffsetM!: number | null;

  @Column({ name: 'off_route_m', type: 'double precision', nullable: true })
  offRouteM!: number | null;
}
