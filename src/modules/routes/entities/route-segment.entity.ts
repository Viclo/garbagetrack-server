import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { Route } from './route.entity';

@Entity('route_segments')
export class RouteSegment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Route, (route) => route.segments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route!: Route;

  @Column({ name: 'segment_index' })
  segmentIndex!: number;

  @Column({ name: 'street_name' })
  streetName!: string;

  @Column({ name: 'start_latitude', type: 'double precision' })
  startLatitude!: number;

  @Column({ name: 'start_longitude', type: 'double precision' })
  startLongitude!: number;

  @Column({ name: 'end_latitude', type: 'double precision' })
  endLatitude!: number;

  @Column({ name: 'end_longitude', type: 'double precision' })
  endLongitude!: number;

  // Real road geometry following the street, as an ordered list of [lat, lng] pairs
  // (from OSRM snapping). Null falls back to a straight start→end line when rendered.
  @Column({ type: 'jsonb', nullable: true })
  path!: [number, number][] | null;

  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  geom!: string | null;

  @BeforeInsert()
  @BeforeUpdate()
  setGeom(): void {
    // geom is the segment's representative midpoint, used by the PostGIS KNN matching
    // for GPS tracking, resident auto-assignment and proximity alerts.
    // TypeORM wraps geometry values with ST_GeomFromGeoJSON, so the value must be
    // a GeoJSON object — not WKT. TypeORM JSON.stringifies the object before binding.
    let lat: number;
    let lng: number;
    if (this.path && this.path.length > 0) {
      // Middle vertex of the real road path — a better representative point than the
      // straight-line midpoint for a curved street.
      const [midLat, midLng] = this.path[Math.floor(this.path.length / 2)];
      lat = midLat;
      lng = midLng;
    } else {
      lat = (this.startLatitude + this.endLatitude) / 2;
      lng = (this.startLongitude + this.endLongitude) / 2;
    }
    (this as unknown as { geom: object }).geom = {
      type: 'Point',
      coordinates: [lng, lat],
    };
  }
}
