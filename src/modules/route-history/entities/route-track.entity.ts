import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import type { IOffRouteStretch, TrackPoint } from '../interfaces/route-history.interface';

/**
 * One finished run, archived out of the live tables (route history, flow 1).
 *
 * Positions live in truck_positions only for the current day so the live map
 * stays small; the nightly archiver turns each finished run into one row here
 * and deletes its fixes. Kept forever.
 *
 * Driver, truck and route are SNAPSHOTS (id + name), not foreign keys: history
 * must still read "Juan, ABC-123, Ruta Norte" after that driver is deleted or
 * the route is renamed, and deleting a driver cascades to route_sessions.
 */
@Entity('route_tracks')
@Index('IDX_route_tracks_tenant_date', ['tenantId', 'localDate'])
@Unique(['routeSessionId'])
export class RouteTrack {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @Column({ name: 'route_session_id', type: 'int' })
  routeSessionId!: number;

  /**
   * Municipality-local day the run STARTED on, which is what the date search
   * matches. A `date`, not derived from started_at at query time, so a run that
   * began at 23:40 is filed under that day and the index can serve the search.
   */
  @Column({ name: 'local_date', type: 'date' })
  localDate!: string;

  @Column({ name: 'driver_id', type: 'int', nullable: true })
  driverId!: number | null;

  @Column({ name: 'driver_name', type: 'varchar', nullable: true })
  driverName!: string | null;

  @Column({ name: 'truck_id', type: 'int', nullable: true })
  truckId!: number | null;

  @Column({ name: 'truck_name', type: 'varchar', nullable: true })
  truckName!: string | null;

  @Column({ name: 'license_plate', type: 'varchar', nullable: true })
  licensePlate!: string | null;

  @Column({ name: 'route_id', type: 'int', nullable: true })
  routeId!: number | null;

  @Column({ name: 'route_name', type: 'varchar', nullable: true })
  routeName!: string | null;

  /** The route's colour that day, snapshotted like its name. */
  @Column({ name: 'route_color', type: 'varchar', length: 7, nullable: true })
  routeColor!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz' })
  endedAt!: Date;

  @Column({ name: 'duration_seconds', type: 'int' })
  durationSeconds!: number;

  @Column({ name: 'point_count', type: 'int' })
  pointCount!: number;

  @Column({ name: 'distance_m', type: 'double precision' })
  distanceM!: number;

  @Column({ name: 'coverage_pct', type: 'double precision', nullable: true })
  coveragePct!: number | null;

  @Column({ name: 'off_route_distance_m', type: 'double precision' })
  offRouteDistanceM!: number;

  @Column({ name: 'off_route_stretches', type: 'jsonb' })
  offRouteStretches!: IOffRouteStretch[];

  /**
   * Every cleaned fix with its time and distance from the route, as tuples
   * (see TrackPoint). This is what the map draws; `path` below is the same
   * line as geometry, for future spatial questions ("which runs passed here").
   */
  @Column({ type: 'jsonb' })
  points!: TrackPoint[];

  @Column({ type: 'geometry', spatialFeatureType: 'LineString', srid: 4326, nullable: true })
  path!: string | null;

  /** The route's centerline as it was when the run was archived. */
  @Column({
    name: 'planned_path',
    type: 'geometry',
    spatialFeatureType: 'LineString',
    srid: 4326,
    nullable: true,
  })
  plannedPath!: string | null;

  @CreateDateColumn({ name: 'archived_at', type: 'timestamptz' })
  archivedAt!: Date;
}
