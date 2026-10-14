import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { OPERATIONAL_TIMEZONE, localDateString } from '../../../common/utils/local-time.util';
import {
  ILiveTrack,
  IOffRouteStretch,
  IRouteTrackDetail,
  IRouteTrackSummary,
  TrackPoint,
} from '../interfaces/route-history.interface';
import {
  geoJsonLineToLatLngs,
  ISessionRow,
  RouteTrackBuilderService,
} from './route-track-builder.service';

/** route_tracks columns behind IRouteTrackSummary. Never selects `points`. */
interface ArchivedRow {
  sessionId: number;
  localDate: string;
  routeId: number | null;
  routeName: string | null;
  routeColor: string | null;
  truckId: number | null;
  truckName: string | null;
  licensePlate: string | null;
  driverId: number | null;
  driverName: string | null;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  pointCount: number;
  distanceM: number;
  coveragePct: number | null;
  offRouteDistanceM: number;
}

const ARCHIVED_SELECT = `
  SELECT route_session_id      AS "sessionId",
         to_char(local_date, 'YYYY-MM-DD') AS "localDate",
         route_id              AS "routeId",
         route_name            AS "routeName",
         route_color           AS "routeColor",
         truck_id              AS "truckId",
         truck_name            AS "truckName",
         license_plate         AS "licensePlate",
         driver_id             AS "driverId",
         driver_name           AS "driverName",
         started_at            AS "startedAt",
         ended_at              AS "endedAt",
         duration_seconds      AS "durationSeconds",
         point_count           AS "pointCount",
         distance_m            AS "distanceM",
         coverage_pct          AS "coveragePct",
         off_route_distance_m  AS "offRouteDistanceM"
    FROM route_tracks`;

/**
 * Route history for the admin panel (flow 1): runs by date, one run in full,
 * and the paths being driven right now.
 *
 * A run is read from route_tracks once archived, and rebuilt from the live
 * tables until then (today's runs, or any the archiver has not reached). The
 * caller never needs to know which: both come out in the same shape.
 */
@Injectable()
export class RouteHistoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly builder: RouteTrackBuilderService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Every run that started on `date` (municipality time), oldest first. */
  async listByDate(date: string = localDateString()): Promise<IRouteTrackSummary[]> {
    const tenantId = this.tenantContext.tenantId;

    const archived = await this.dataSource.query<ArchivedRow[]>(
      `${ARCHIVED_SELECT} WHERE tenant_id = $1 AND local_date = $2::date`,
      [tenantId, date],
    );

    const live = await this.dataSource.query<ISessionRow[]>(
      `${RouteTrackBuilderService.SESSION_SELECT}
        WHERE rs.tenant_id = $2
          AND (rs.started_at AT TIME ZONE $1)::date = $3::date
          AND NOT EXISTS (SELECT 1 FROM route_tracks rt WHERE rt.route_session_id = rs.id)`,
      [OPERATIONAL_TIMEZONE, tenantId, date],
    );
    const liveSummaries: IRouteTrackSummary[] = [];
    for (const session of live) {
      liveSummaries.push(
        this.builder.toSummary(await this.builder.build(this.dataSource, session)),
      );
    }

    return [...archived.map((row) => this.toSummary(row)), ...liveSummaries].sort((a, b) =>
      a.startedAt.localeCompare(b.startedAt),
    );
  }

  /** One run with its points and the route it was meant to follow. */
  async getDetail(sessionId: number): Promise<IRouteTrackDetail> {
    const tenantId = this.tenantContext.tenantId;

    const [archived] = await this.dataSource.query<
      Array<
        ArchivedRow & {
          points: TrackPoint[];
          plannedPath: string | null;
          offRouteStretches: IOffRouteStretch[];
        }
      >
    >(
      `SELECT sub.*, rt.points, rt.off_route_stretches AS "offRouteStretches",
              ST_AsGeoJSON(rt.planned_path) AS "plannedPath"
         FROM (${ARCHIVED_SELECT} WHERE tenant_id = $1 AND route_session_id = $2) sub
         JOIN route_tracks rt ON rt.route_session_id = sub."sessionId"`,
      [tenantId, sessionId],
    );
    if (archived) {
      return {
        ...this.toSummary(archived),
        points: archived.points,
        plannedPath: geoJsonLineToLatLngs(archived.plannedPath),
        offRouteStretches: archived.offRouteStretches,
      };
    }

    const session = await this.builder.findSession(this.dataSource, tenantId, sessionId);
    if (!session) throw new NotFoundException(`Recorrido ${sessionId} no encontrado`);

    const built = await this.builder.build(this.dataSource, session);
    return {
      ...this.builder.toSummary(built),
      points: built.points,
      plannedPath: await this.builder.loadRoutePath(this.dataSource, tenantId, session.routeId),
      offRouteStretches: built.metrics.offRouteStretches,
    };
  }

  /**
   * Today's driven paths for the live map's first paint: every run that is
   * open now, plus the ones that started today and already finished, so a
   * truck marked "Ruta finalizada" still shows what it covered (and a page
   * reload does not wipe paths the socket had drawn). After that the map
   * extends each path from the socket, so this is called on load and on
   * reconnect, not on every poll.
   */
  async getLive(): Promise<ILiveTrack[]> {
    const tenantId = this.tenantContext.tenantId;
    const open = await this.dataSource.query<ISessionRow[]>(
      `${RouteTrackBuilderService.SESSION_SELECT}
        WHERE rs.tenant_id = $2
          AND (rs.ended_at IS NULL
               OR (rs.started_at AT TIME ZONE $1)::date = $3::date)
          AND NOT EXISTS (SELECT 1 FROM route_tracks rt WHERE rt.route_session_id = rs.id)`,
      [OPERATIONAL_TIMEZONE, tenantId, localDateString()],
    );

    const tracks: ILiveTrack[] = [];
    for (const session of open) {
      tracks.push({
        sessionId: session.id,
        truckId: session.truckId,
        routeId: session.routeId,
        routeColor: session.routeColor,
        points: await this.builder.loadPoints(this.dataSource, session),
      });
    }
    return tracks;
  }

  private toSummary(row: ArchivedRow): IRouteTrackSummary {
    return {
      sessionId: row.sessionId,
      localDate: row.localDate,
      routeId: row.routeId,
      routeName: row.routeName,
      routeColor: row.routeColor,
      truckId: row.truckId,
      truckName: row.truckName,
      licensePlate: row.licensePlate,
      driverId: row.driverId,
      driverName: row.driverName,
      startedAt: new Date(row.startedAt).toISOString(),
      endedAt: new Date(row.endedAt).toISOString(),
      durationSeconds: row.durationSeconds,
      active: false,
      archived: true,
      pointCount: row.pointCount,
      distanceM: Number(row.distanceM),
      coveragePct: row.coveragePct === null ? null : Number(row.coveragePct),
      offRouteDistanceM: Number(row.offRouteDistanceM),
    };
  }
}
