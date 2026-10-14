import { Injectable } from '@nestjs/common';
import { OPERATIONAL_TIMEZONE } from '../../../common/utils/local-time.util';
import {
  IQueryable,
  IRawFix,
  IRouteTrackSummary,
  ITrackMetrics,
  TrackPoint,
} from '../interfaces/route-history.interface';
import { cleanFixes, computeTrackMetrics } from '../utils/track-metrics.util';

/** A route_sessions row with the names the history shows. */
export interface ISessionRow {
  id: number;
  tenantId: number;
  driverId: number | null;
  driverName: string | null;
  truckId: number | null;
  truckName: string | null;
  licensePlate: string | null;
  routeId: number | null;
  routeName: string | null;
  routeColor: string | null;
  startedAt: Date;
  endedAt: Date | null;
  localDate: string;
  centerlineLengthM: number | null;
}

/** A run rebuilt from the live tables. */
export interface IBuiltTrack {
  session: ISessionRow;
  points: TrackPoint[];
  metrics: ITrackMetrics;
}

/**
 * Rebuilds a run from route_sessions + truck_positions. Shared by the history
 * endpoints (today's runs are still live) and the nightly archiver, so a run
 * looks the same before and after it is archived.
 *
 * Every method takes the tenant id explicitly instead of reading
 * TenantContextService: the archiver runs outside any request and walks every
 * municipality. Callers serving HTTP must pass the request's tenant.
 */
@Injectable()
export class RouteTrackBuilderService {
  /** SELECT list for ISessionRow; $1 must be the operational timezone. */
  static readonly SESSION_SELECT = `
    SELECT rs.id,
           rs.tenant_id           AS "tenantId",
           rs.driver_id           AS "driverId",
           d.name                 AS "driverName",
           rs.truck_id            AS "truckId",
           t.name                 AS "truckName",
           t.license_plate        AS "licensePlate",
           rs.route_id            AS "routeId",
           r.name                 AS "routeName",
           r.color                AS "routeColor",
           rs.started_at          AS "startedAt",
           rs.ended_at            AS "endedAt",
           to_char(rs.started_at AT TIME ZONE $1, 'YYYY-MM-DD') AS "localDate",
           r.centerline_length_m  AS "centerlineLengthM"
      FROM route_sessions rs
      LEFT JOIN drivers d ON d.id = rs.driver_id
      LEFT JOIN trucks  t ON t.id = rs.truck_id
      LEFT JOIN routes  r ON r.id = rs.route_id`;

  async findSession(
    db: IQueryable,
    tenantId: number,
    sessionId: number,
  ): Promise<ISessionRow | null> {
    const [row] = await db.query<ISessionRow[]>(
      `${RouteTrackBuilderService.SESSION_SELECT}
        WHERE rs.tenant_id = $2 AND rs.id = $3`,
      [OPERATIONAL_TIMEZONE, tenantId, sessionId],
    );
    return row ?? null;
  }

  /**
   * The run's fixes, by session id. Fixes stored before positions carried a
   * session id fall back to the truck and the session's time window; that
   * branch matches nothing once those old fixes are archived.
   */
  async loadPoints(db: IQueryable, session: ISessionRow): Promise<TrackPoint[]> {
    const rows = await db.query<IRawFix[]>(
      `SELECT latitude,
              longitude,
              COALESCE(recorded_at, timestamp) AS "recordedAt",
              off_route_m                      AS "offRouteM",
              route_offset_m                   AS "routeOffsetM"
         FROM truck_positions
        WHERE tenant_id = $1
          AND (
                route_session_id = $2
             OR (route_session_id IS NULL
                 AND truck_id = $3
                 AND COALESCE(recorded_at, timestamp) >= $4
                 AND COALESCE(recorded_at, timestamp) <= COALESCE($5::timestamptz, now()))
          )`,
      [session.tenantId, session.id, session.truckId, session.startedAt, session.endedAt],
    );
    return cleanFixes(
      rows.map((r) => ({
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        recordedAt: new Date(r.recordedAt),
        offRouteM: r.offRouteM === null ? null : Number(r.offRouteM),
        routeOffsetM: r.routeOffsetM === null ? null : Number(r.routeOffsetM),
      })),
    );
  }

  async build(db: IQueryable, session: ISessionRow): Promise<IBuiltTrack> {
    const points = await this.loadPoints(db, session);
    const lengthM = session.centerlineLengthM === null ? null : Number(session.centerlineLengthM);
    return { session, points, metrics: computeTrackMetrics(points, lengthM) };
  }

  /** The route's current centerline as [lat, lng] pairs, for runs not yet archived. */
  async loadRoutePath(
    db: IQueryable,
    tenantId: number,
    routeId: number | null,
  ): Promise<[number, number][] | null> {
    if (routeId === null) return null;
    const [row] = await db.query<Array<{ geojson: string | null }>>(
      `SELECT ST_AsGeoJSON(centerline) AS geojson FROM routes WHERE id = $1 AND tenant_id = $2`,
      [routeId, tenantId],
    );
    return geoJsonLineToLatLngs(row?.geojson ?? null);
  }

  toSummary(built: IBuiltTrack): IRouteTrackSummary {
    const { session, metrics } = built;
    const { startedAt, endedAt } = runSpan(session, built.points);
    return {
      sessionId: session.id,
      localDate: session.localDate,
      routeId: session.routeId,
      routeName: session.routeName,
      routeColor: session.routeColor,
      truckId: session.truckId,
      truckName: session.truckName,
      licensePlate: session.licensePlate,
      driverId: session.driverId,
      driverName: session.driverName,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt ? endedAt.toISOString() : null,
      durationSeconds: durationSeconds(startedAt, endedAt),
      active: endedAt === null,
      archived: false,
      pointCount: metrics.pointCount,
      distanceM: metrics.distanceM,
      coveragePct: metrics.coveragePct,
      offRouteDistanceM: metrics.offRouteDistanceM,
    };
  }
}

/**
 * When the run really started and ended, for showing it. Usually the
 * session's own times, but the driver app replays fixes it queued without
 * signal, and when it had to reopen a closed session those fixes predate the
 * new session's start. Without widening the span the history would read
 * "12:36 – 12:39" next to an off-route stretch at 12:14.
 */
export function runSpan(
  session: Pick<ISessionRow, 'startedAt' | 'endedAt'>,
  points: TrackPoint[],
): { startedAt: Date; endedAt: Date | null } {
  let startedAt = new Date(session.startedAt);
  let endedAt = session.endedAt ? new Date(session.endedAt) : null;
  const first = points[0];
  const last = points[points.length - 1];
  if (first && first[2] * 1000 < startedAt.getTime()) startedAt = new Date(first[2] * 1000);
  if (endedAt && last && last[2] * 1000 > endedAt.getTime()) endedAt = new Date(last[2] * 1000);
  return { startedAt, endedAt };
}

export function durationSeconds(startedAt: Date, endedAt: Date | null): number {
  return Math.max(0, Math.floor(((endedAt ?? new Date()).getTime() - startedAt.getTime()) / 1000));
}

/** PostGIS GeoJSON LineString ([lng, lat]) → Leaflet order ([lat, lng]). */
export function geoJsonLineToLatLngs(geojson: string | null): [number, number][] | null {
  if (!geojson) return null;
  try {
    const parsed = JSON.parse(geojson) as { coordinates?: [number, number][] };
    return parsed.coordinates?.map(([lng, lat]) => [lat, lng]) ?? null;
  } catch {
    return null;
  }
}
