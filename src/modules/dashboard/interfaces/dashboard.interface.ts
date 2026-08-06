import { DayOfWeek } from '../../../common/enums/day-of-week.enum';

/** How today's scheduled run is actually going. */
export type RunStatus = 'in_progress' | 'completed' | 'not_started';

/** One truck's assignment for today, paired with whatever really happened. */
export interface IDashboardRun {
  scheduleId: number;
  truckId: number;
  truckName: string;
  licensePlate: string;
  driverId: number | null;
  driverName: string | null;
  routeId: number;
  routeName: string;
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  /** Elapsed for a run in progress, total for a finished one; null before it starts. */
  durationSeconds: number | null;
  /** Last GPS fix of this truck during the run — how the map knows it is alive. */
  lastPositionAt: string | null;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Something an admin should act on, with the screen that fixes it.
 *
 * The dashboard's job is not to show numbers, it is to surface the handful of
 * broken configurations that silently stop residents being notified — a route
 * nobody drew, a truck with no driver, a day with no schedule.
 */
export interface IDashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  count: number;
  /** Admin path that resolves it, e.g. '/routes'. */
  href: string;
}

export interface IDashboardOverview {
  /** Municipality-local day this snapshot describes (YYYY-MM-DD). */
  date: string;
  dayOfWeek: DayOfWeek | null;
  fleet: {
    totalTrucks: number;
    activeTrucks: number;
    trucksWithoutDriver: number;
    totalDrivers: number;
    activeDrivers: number;
    licensesExpired: number;
    licensesExpiringSoon: number;
  };
  routes: {
    total: number;
    active: number;
    withoutSegments: number;
    unscheduled: number;
  };
  residents: {
    total: number;
    active: number;
    withRoute: number;
    withoutRoute: number;
    beyondLimit: number;
    /** Active residents that a route can actually reach, as a percentage. */
    coveragePercent: number;
  };
  today: {
    scheduled: number;
    inProgress: number;
    completed: number;
    notStarted: number;
    runs: IDashboardRun[];
  };
  notifications: {
    todaySent: number;
    todayFailed: number;
    last7DaysSent: number;
    series: Array<{ date: string; sent: number; failed: number }>;
  };
  alerts: IDashboardAlert[];
}
