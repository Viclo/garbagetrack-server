import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  DAY_LABELS_ES,
  localDateString,
  localDayOfWeek,
  OPERATIONAL_TIMEZONE,
} from '../../../common/utils/local-time.util';
import {
  IDashboardAlert,
  IDashboardOverview,
  IDashboardRun,
  RunStatus,
} from '../interfaces/dashboard.interface';

/** A licence lapsing inside this window is worth flagging before it bites. */
const LICENSE_WARNING_DAYS = 30;
/** Days of notification history the dashboard chart covers. */
const SERIES_DAYS = 7;

interface FleetRow {
  totalTrucks: string;
  activeTrucks: string;
  trucksWithoutDriver: string;
  totalDrivers: string;
  activeDrivers: string;
  licensesExpired: string;
  licensesExpiringSoon: string;
}

interface RouteRow {
  total: string;
  active: string;
  withoutSegments: string;
  unscheduled: string;
}

interface ResidentRow {
  total: string;
  active: string;
  withRoute: string;
  beyondLimit: string;
}

interface RunRow {
  scheduleId: number;
  truckId: number;
  truckName: string;
  licensePlate: string;
  driverId: number | null;
  driverName: string | null;
  routeId: number;
  routeName: string;
  startedAt: Date | null;
  endedAt: Date | null;
  lastPositionAt: Date | null;
}

/**
 * Everything the admin dashboard shows, assembled in one round trip.
 *
 * It answers one question — "is my municipality being served today, and if not
 * what is broken?" — so the counters and the today-vs-plan comparison have to
 * come from the same snapshot. Splitting them across calls let the page show a
 * truck as active in one card and idle in the next.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly systemConfigService: SystemConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getOverview(): Promise<IDashboardOverview> {
    const tenantId = this.tenantContext.tenantId;
    const date = localDateString();
    const dayOfWeek = localDayOfWeek();

    const [fleet, routes, residents, runRows, series, maxSnapDistanceM] = await Promise.all([
      this.loadFleet(tenantId),
      this.loadRoutes(tenantId),
      this.loadResidents(tenantId),
      dayOfWeek ? this.loadTodayRuns(tenantId, dayOfWeek) : Promise.resolve([]),
      this.notificationsService.countByDay(SERIES_DAYS),
      this.systemConfigService.getMaxSnapDistanceM(),
    ]);

    const runs = runRows.map((row) => this.toRun(row));
    const today = {
      scheduled: runs.length,
      inProgress: runs.filter((r) => r.status === 'in_progress').length,
      completed: runs.filter((r) => r.status === 'completed').length,
      notStarted: runs.filter((r) => r.status === 'not_started').length,
      runs,
    };

    const todaySeries = series[series.length - 1];
    const notifications = {
      todaySent: todaySeries?.sent ?? 0,
      todayFailed: todaySeries?.failed ?? 0,
      last7DaysSent: series.reduce((sum, day) => sum + day.sent, 0),
      series,
    };

    const overview: IDashboardOverview = {
      date,
      dayOfWeek,
      fleet,
      routes,
      residents,
      today,
      notifications,
      alerts: [],
    };
    overview.alerts = this.buildAlerts(overview, maxSnapDistanceM, dayOfWeek);
    return overview;
  }

  private async loadFleet(tenantId: number): Promise<IDashboardOverview['fleet']> {
    const [row] = await this.dataSource.query<FleetRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM trucks WHERE tenant_id = $1)                              AS "totalTrucks",
         (SELECT COUNT(*) FROM trucks WHERE tenant_id = $1 AND is_active)                AS "activeTrucks",
         (SELECT COUNT(*) FROM trucks
           WHERE tenant_id = $1 AND is_active AND driver_id IS NULL)                     AS "trucksWithoutDriver",
         (SELECT COUNT(*) FROM drivers WHERE tenant_id = $1)                             AS "totalDrivers",
         (SELECT COUNT(*) FROM drivers WHERE tenant_id = $1 AND is_active)               AS "activeDrivers",
         (SELECT COUNT(*) FROM drivers
           WHERE tenant_id = $1 AND is_active
             AND license_expires_at IS NOT NULL
             AND license_expires_at < CURRENT_DATE)                                      AS "licensesExpired",
         (SELECT COUNT(*) FROM drivers
           WHERE tenant_id = $1 AND is_active
             AND license_expires_at IS NOT NULL
             AND license_expires_at >= CURRENT_DATE
             AND license_expires_at < CURRENT_DATE + ($2::int * INTERVAL '1 day'))       AS "licensesExpiringSoon"`,
      [tenantId, LICENSE_WARNING_DAYS],
    );

    return {
      totalTrucks: Number(row?.totalTrucks ?? 0),
      activeTrucks: Number(row?.activeTrucks ?? 0),
      trucksWithoutDriver: Number(row?.trucksWithoutDriver ?? 0),
      totalDrivers: Number(row?.totalDrivers ?? 0),
      activeDrivers: Number(row?.activeDrivers ?? 0),
      licensesExpired: Number(row?.licensesExpired ?? 0),
      licensesExpiringSoon: Number(row?.licensesExpiringSoon ?? 0),
    };
  }

  private async loadRoutes(tenantId: number): Promise<IDashboardOverview['routes']> {
    const [row] = await this.dataSource.query<RouteRow[]>(
      `SELECT
         COUNT(*)                                        AS "total",
         COUNT(*) FILTER (WHERE r.is_active)             AS "active",
         COUNT(*) FILTER (
           WHERE r.is_active AND NOT EXISTS (
             SELECT 1 FROM route_segments s WHERE s.route_id = r.id))                 AS "withoutSegments",
         COUNT(*) FILTER (
           WHERE r.is_active AND NOT EXISTS (
             SELECT 1 FROM weekly_schedules w WHERE w.route_id = r.id))               AS "unscheduled"
       FROM routes r
       WHERE r.tenant_id = $1`,
      [tenantId],
    );

    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      withoutSegments: Number(row?.withoutSegments ?? 0),
      unscheduled: Number(row?.unscheduled ?? 0),
    };
  }

  private async loadResidents(tenantId: number): Promise<IDashboardOverview['residents']> {
    // The walking limit is applied at assignment time, so a stored distance
    // over it means the route moved away from a house that is still anchored
    // to it — exactly the record an admin has to look at.
    const maxDistance = await this.systemConfigService.getMaxSnapDistanceM();
    const [row] = await this.dataSource.query<ResidentRow[]>(
      `SELECT
         COUNT(*)                                                               AS "total",
         COUNT(*) FILTER (WHERE is_active)                                      AS "active",
         COUNT(*) FILTER (WHERE is_active AND route_id IS NOT NULL)             AS "withRoute",
         COUNT(*) FILTER (
           WHERE is_active AND distance_to_route_m > $2)                        AS "beyondLimit"
       FROM residents
       WHERE tenant_id = $1`,
      [tenantId, maxDistance],
    );

    const total = Number(row?.total ?? 0);
    const active = Number(row?.active ?? 0);
    const withRoute = Number(row?.withRoute ?? 0);

    return {
      total,
      active,
      withRoute,
      withoutRoute: active - withRoute,
      beyondLimit: Number(row?.beyondLimit ?? 0),
      coveragePercent: active === 0 ? 0 : Math.round((withRoute / active) * 100),
    };
  }

  /**
   * Today's plan joined to what the trucks actually did.
   *
   * The session is matched on the schedule's own truck AND route, so a driver
   * running yesterday's leftover session on a different route does not make
   * today's assignment look done.
   */
  private async loadTodayRuns(tenantId: number, dayOfWeek: string): Promise<RunRow[]> {
    return this.dataSource.query<RunRow[]>(
      `SELECT w.id                AS "scheduleId",
              t.id                AS "truckId",
              t.name              AS "truckName",
              t.license_plate     AS "licensePlate",
              d.id                AS "driverId",
              d.name              AS "driverName",
              r.id                AS "routeId",
              r.name              AS "routeName",
              s.started_at        AS "startedAt",
              s.ended_at          AS "endedAt",
              p.last_position_at  AS "lastPositionAt"
       FROM weekly_schedules w
       JOIN trucks t ON t.id = w.truck_id
       JOIN routes r ON r.id = w.route_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       -- Today's session for this exact truck+route pairing; open runs win.
       LEFT JOIN LATERAL (
         SELECT rs.started_at, rs.ended_at
         FROM route_sessions rs
         WHERE rs.tenant_id = w.tenant_id
           AND rs.truck_id = w.truck_id
           AND rs.route_id = w.route_id
           -- started_at is timestamptz, so one AT TIME ZONE lands it on the
           -- municipality's wall clock. A run that began at 23:30 local must
           -- count as today's, not as tomorrow's UTC date.
           AND (rs.started_at AT TIME ZONE $3)::date = $2::date
         ORDER BY (rs.ended_at IS NULL) DESC, rs.started_at DESC
         LIMIT 1
       ) s ON TRUE
       LEFT JOIN LATERAL (
         SELECT MAX(COALESCE(tp.recorded_at, tp.timestamp)) AS last_position_at
         FROM truck_positions tp
         WHERE tp.tenant_id = w.tenant_id
           AND tp.truck_id = w.truck_id
           AND s.started_at IS NOT NULL
           AND COALESCE(tp.recorded_at, tp.timestamp) >= s.started_at
       ) p ON TRUE
       WHERE w.tenant_id = $1
         AND w.day_of_week::text = $4
       ORDER BY t.name ASC`,
      [tenantId, localDateString(), OPERATIONAL_TIMEZONE, dayOfWeek],
    );
  }

  private toRun(row: RunRow): IDashboardRun {
    const startedAt = row.startedAt ? new Date(row.startedAt) : null;
    const endedAt = row.endedAt ? new Date(row.endedAt) : null;

    let status: RunStatus = 'not_started';
    if (startedAt) status = endedAt ? 'completed' : 'in_progress';

    const durationSeconds = startedAt
      ? Math.max(0, Math.floor(((endedAt ?? new Date()).getTime() - startedAt.getTime()) / 1000))
      : null;

    return {
      scheduleId: row.scheduleId,
      truckId: row.truckId,
      truckName: row.truckName,
      licensePlate: row.licensePlate,
      driverId: row.driverId,
      driverName: row.driverName,
      routeId: row.routeId,
      routeName: row.routeName,
      status,
      startedAt: startedAt?.toISOString() ?? null,
      endedAt: endedAt?.toISOString() ?? null,
      durationSeconds,
      lastPositionAt: row.lastPositionAt ? new Date(row.lastPositionAt).toISOString() : null,
    };
  }

  /**
   * The broken configurations, ordered worst first.
   *
   * Each one is a reason some resident will not be told the truck is coming,
   * and each names the screen that fixes it — a count on its own only tells an
   * admin that something is wrong, not where to go.
   */
  private buildAlerts(
    overview: IDashboardOverview,
    maxSnapDistanceM: number,
    dayOfWeek: string | null,
  ): IDashboardAlert[] {
    const alerts: IDashboardAlert[] = [];
    const { fleet, routes, residents, today } = overview;
    const dayLabel = dayOfWeek ? DAY_LABELS_ES[dayOfWeek as keyof typeof DAY_LABELS_ES] : 'hoy';

    if (today.scheduled === 0) {
      alerts.push({
        id: 'no-schedule-today',
        severity: 'critical',
        title: `Ningún camión tiene ruta programada para hoy ${dayLabel}`,
        detail:
          'Los conductores no podrán iniciar la ruta y ningún vecino recibirá aviso. Registra el horario del día.',
        count: 1,
        href: '/schedules',
      });
    }

    if (routes.withoutSegments > 0) {
      alerts.push({
        id: 'routes-without-segments',
        severity: 'critical',
        title: 'Rutas activas sin recorrido dibujado',
        detail:
          'Sin tramos en el mapa no se puede calcular por dónde va el camión ni avisar a los vecinos.',
        count: routes.withoutSegments,
        href: '/routes',
      });
    }

    if (fleet.licensesExpired > 0) {
      alerts.push({
        id: 'licenses-expired',
        severity: 'critical',
        title: 'Conductores con licencia vencida',
        detail: 'No deberían salir a ruta hasta renovar su licencia.',
        count: fleet.licensesExpired,
        href: '/drivers',
      });
    }

    if (residents.withoutRoute > 0) {
      alerts.push({
        id: 'residents-without-route',
        severity: 'warning',
        title: 'Residentes activos sin ruta asignada',
        detail: 'Están registrados pero no reciben ningún aviso. Revisa su ubicación o asígnales una ruta.',
        count: residents.withoutRoute,
        href: '/residents',
      });
    }

    if (residents.beyondLimit > 0) {
      alerts.push({
        id: 'residents-beyond-limit',
        severity: 'warning',
        title: `Residentes a más de ${maxSnapDistanceM} m de su ruta`,
        detail: 'Reciben avisos de un camión que quizá no llegue hasta su casa. Revisa la asignación.',
        count: residents.beyondLimit,
        href: '/residents',
      });
    }

    if (fleet.trucksWithoutDriver > 0) {
      alerts.push({
        id: 'trucks-without-driver',
        severity: 'warning',
        title: 'Camiones activos sin conductor asignado',
        detail: 'Nadie puede iniciar la ruta de estos camiones desde la aplicación.',
        count: fleet.trucksWithoutDriver,
        href: '/trucks',
      });
    }

    if (fleet.licensesExpiringSoon > 0) {
      alerts.push({
        id: 'licenses-expiring',
        severity: 'warning',
        title: `Licencias que vencen en menos de ${LICENSE_WARNING_DAYS} días`,
        detail: 'Programa la renovación antes de que el conductor quede fuera de servicio.',
        count: fleet.licensesExpiringSoon,
        href: '/drivers',
      });
    }

    if (routes.unscheduled > 0) {
      alerts.push({
        id: 'routes-unscheduled',
        severity: 'info',
        title: 'Rutas activas sin ningún horario',
        detail: 'Están configuradas pero ningún camión las recorre en toda la semana.',
        count: routes.unscheduled,
        href: '/schedules',
      });
    }

    return alerts;
  }
}
