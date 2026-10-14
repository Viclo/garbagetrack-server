import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OPERATIONAL_TIMEZONE } from '../../../common/utils/local-time.util';
import { durationSeconds, RouteTrackBuilderService, runSpan } from './route-track-builder.service';
import { toLineStringWkt } from '../utils/track-metrics.util';

/** How often to look for runs to archive. Cheap when there is nothing to do. */
const ARCHIVE_INTERVAL_MS = 15 * 60 * 1000;
/** First pass shortly after boot, so a deploy at night does not skip a day. */
const FIRST_RUN_DELAY_MS = 60 * 1000;
/** Runs archived per pass; the next pass picks up the rest. */
const BATCH_SIZE = 50;

/**
 * Moves finished runs out of the live tables (route history, flow 1).
 *
 * The live map and the proximity engine only ever need today's fixes, so a
 * run that ended BEFORE today (municipality time) is rebuilt into one
 * route_tracks row and its fixes are deleted, in one transaction: a failure
 * leaves the run live and untouched for the next pass, never half-moved.
 * Runs that ended today stay live until midnight, so "today" in the history
 * screen and the live map read the same data. A run still open across
 * midnight waits until it closes.
 *
 * Unscoped on purpose: it walks every municipality, outside any request.
 * Every query carries the session's own tenant_id instead of the request
 * context. Never call it from a controller.
 *
 * A timer, like RouteSessionService's sweep, rather than @nestjs/schedule:
 * one more dependency for one periodic job is not worth it. With a single
 * instance there is no race; with several, the unique route_session_id and
 * ON CONFLICT DO NOTHING keep a double archive harmless.
 */
@Injectable()
export class RouteTrackArchiverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RouteTrackArchiverService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private firstRun: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly builder: RouteTrackBuilderService,
  ) {}

  onModuleInit(): void {
    const tick = (): void => {
      this.archivePending().catch((err) => this.logger.error('Route track archiving failed', err));
    };
    this.firstRun = setTimeout(tick, FIRST_RUN_DELAY_MS);
    this.timer = setInterval(tick, ARCHIVE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.timer) clearInterval(this.timer);
  }

  /** Archives every run that ended before today. Returns how many it moved. */
  async archivePending(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let archived = 0;
    // A run that fails to archive is skipped for the rest of this pass (and
    // its fixes kept), so one bad row cannot stall every other municipality.
    const failed: number[] = [];
    try {
      for (;;) {
        const pending = await this.dataSource.query<Array<{ id: number; tenantId: number }>>(
          `SELECT rs.id, rs.tenant_id AS "tenantId"
             FROM route_sessions rs
            WHERE rs.ended_at IS NOT NULL
              AND rs.ended_at < (date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)
              AND NOT EXISTS (SELECT 1 FROM route_tracks rt WHERE rt.route_session_id = rs.id)
              AND rs.id <> ALL($3::int[])
            ORDER BY rs.id
            LIMIT $2`,
          [OPERATIONAL_TIMEZONE, BATCH_SIZE, failed],
        );
        if (!pending.length) break;

        for (const { id, tenantId } of pending) {
          try {
            await this.archiveOne(tenantId, id);
            archived += 1;
          } catch (err) {
            failed.push(id);
            this.logger.error(`Could not archive route session ${id}`, err);
          }
        }
        if (pending.length < BATCH_SIZE) break;
      }

      await this.deleteOrphanFixes();
      if (archived) this.logger.log(`Archived ${archived} finished run(s) into route history`);
      return archived;
    } finally {
      this.running = false;
    }
  }

  private async archiveOne(tenantId: number, sessionId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const session = await this.builder.findSession(manager, tenantId, sessionId);
      if (!session || !session.endedAt) return;

      const { points, metrics } = await this.builder.build(manager, session);
      // The session's own window selects which legacy fixes belong to it (and
      // must match loadPoints); the widened span is what the history shows.
      const startedAt = new Date(session.startedAt);
      const endedAt = new Date(session.endedAt);
      const span = runSpan(session, points);
      const shownStart = span.startedAt;
      const shownEnd = span.endedAt ?? endedAt;

      await manager.query(
        `INSERT INTO route_tracks (
           tenant_id, route_session_id, local_date,
           driver_id, driver_name, truck_id, truck_name, license_plate, route_id, route_name, route_color,
           started_at, ended_at, duration_seconds,
           point_count, distance_m, coverage_pct, off_route_distance_m, off_route_stretches,
           points, path, planned_path)
         VALUES (
           $1, $2, $3::date,
           $4, $5, $6, $7, $8, $9, $10, $21,
           $11, $12, $13,
           $14, $15, $16, $17, $18::jsonb,
           $19::jsonb,
           CASE WHEN $20::text IS NULL THEN NULL ELSE ST_GeomFromText($20::text, 4326) END,
           (SELECT centerline FROM routes WHERE id = $9 AND tenant_id = $1))
         ON CONFLICT (route_session_id) DO NOTHING`,
        [
          tenantId,
          session.id,
          session.localDate,
          session.driverId,
          session.driverName,
          session.truckId,
          session.truckName,
          session.licensePlate,
          session.routeId,
          session.routeName,
          shownStart,
          shownEnd,
          durationSeconds(shownStart, shownEnd),
          metrics.pointCount,
          metrics.distanceM,
          metrics.coveragePct,
          metrics.offRouteDistanceM,
          JSON.stringify(metrics.offRouteStretches),
          JSON.stringify(points),
          toLineStringWkt(points),
          session.routeColor,
        ],
      );

      // Same selection as loadPoints, so exactly the archived fixes go.
      await manager.query(
        `DELETE FROM truck_positions
          WHERE tenant_id = $1
            AND (
                  route_session_id = $2
               OR (route_session_id IS NULL
                   AND truck_id = $3
                   AND COALESCE(recorded_at, timestamp) >= $4
                   AND COALESCE(recorded_at, timestamp) <= $5)
            )`,
        [tenantId, session.id, session.truckId, startedAt, endedAt],
      );
    });
  }

  /**
   * Fixes from before today that no run will ever claim: sent outside any
   * session, or left behind by a run already archived. Nothing can draw them,
   * and left alone they would keep yesterday's trucks on the live map.
   *
   * Deliberately narrow. A fix that belongs, by id or by time window, to a run
   * NOT yet archived (still open across midnight, or one that failed this
   * pass) is kept: deleting it would lose that run's path for good.
   */
  private async deleteOrphanFixes(): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM truck_positions tp
        WHERE COALESCE(tp.recorded_at, tp.timestamp)
                < (date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)
          AND (tp.route_session_id IS NULL
               OR EXISTS (SELECT 1 FROM route_tracks rt
                           WHERE rt.route_session_id = tp.route_session_id))
          AND NOT EXISTS (
                SELECT 1 FROM route_sessions rs
                 WHERE rs.truck_id = tp.truck_id
                   AND tp.route_session_id IS NULL
                   AND NOT EXISTS (SELECT 1 FROM route_tracks rt
                                    WHERE rt.route_session_id = rs.id)
                   AND COALESCE(tp.recorded_at, tp.timestamp)
                       BETWEEN rs.started_at AND COALESCE(rs.ended_at, now()))`,
      [OPERATIONAL_TIMEZONE],
    );
  }
}
