/**
 * One stored fix of a run, as a tuple to keep a 4-hour run (~1,400 fixes)
 * small both in the jsonb column and on the wire:
 *
 *   [latitude, longitude, epochSeconds, offRouteM, routeOffsetM]
 *
 * epochSeconds is the DEVICE time of the fix. offRouteM is how far from the
 * route's centerline it was; routeOffsetM how far along the route. Both are
 * null when the route had no centerline when the fix arrived.
 */
export type TrackPoint = [number, number, number, number | null, number | null];

/** A fix as read from truck_positions, before cleaning. */
export interface IRawFix {
  latitude: number;
  longitude: number;
  recordedAt: Date;
  offRouteM: number | null;
  routeOffsetM: number | null;
}

/** A continuous stretch the truck drove away from its assigned route. */
export interface IOffRouteStretch {
  startedAt: string;
  endedAt: string;
  distanceM: number;
  maxOffRouteM: number;
}

export interface ITrackMetrics {
  pointCount: number;
  distanceM: number;
  /** Share of the route's length the truck drove along; null without a centerline. */
  coveragePct: number | null;
  offRouteDistanceM: number;
  offRouteStretches: IOffRouteStretch[];
}

/** One run in the history list. */
export interface IRouteTrackSummary {
  sessionId: number;
  localDate: string;
  routeId: number | null;
  routeName: string | null;
  /** The route's identity colour (snapshotted for archived runs). */
  routeColor: string | null;
  truckId: number | null;
  truckName: string | null;
  licensePlate: string | null;
  driverId: number | null;
  driverName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  /** Still running right now. */
  active: boolean;
  /** Already moved into route_tracks (false while it is still in the live table). */
  archived: boolean;
  pointCount: number;
  distanceM: number;
  coveragePct: number | null;
  offRouteDistanceM: number;
}

/** One run with everything needed to draw it. */
export interface IRouteTrackDetail extends IRouteTrackSummary {
  points: TrackPoint[];
  /** The route as it was planned for this run, [lat, lng] pairs; null if unknown. */
  plannedPath: [number, number][] | null;
  offRouteStretches: IOffRouteStretch[];
}

/** The path driven so far by a run that is open now, for the live map. */
export interface ILiveTrack {
  sessionId: number;
  truckId: number | null;
  routeId: number | null;
  routeColor: string | null;
  points: TrackPoint[];
}

/** Anything that can run SQL: the DataSource, or a transaction's manager. */
export interface IQueryable {
  query: <T = unknown>(sql: string, parameters?: unknown[]) => Promise<T>;
}
