import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';

export interface IGpsPosition {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface ITruckPositionUpdate {
  truckId: number;
  position: IGpsPosition;
  currentSegmentIndex: number | null;
}

export interface ISegmentMatch {
  id: number;
  segmentIndex: number;
  streetName: string;
}

export interface IDriverClientData {
  user: IJwtPayload;
  truckId?: number;
  routeId?: number;
  sessionId?: number;
}

/** Marks a token as the resident live-view kind rather than a user session (E4). */
export const RESIDENT_LIVE_TOKEN = 'resident-live';

/**
 * Claims of the short-lived token that lets ONE resident watch ONE route.
 * It carries no role and no user id: a resident is not a user of the system,
 * and this token must never widen into anything but a read-only route feed.
 */
export interface IResidentLivePayload {
  typ: typeof RESIDENT_LIVE_TOKEN;
  /** Resident id — the record the owner token proved control of. */
  sub: number;
  tenantId: number;
  /** The only route this token may watch: their assigned one. */
  routeId: number;
}

/** Socket state for a watching resident. Deliberately not shaped like a driver's. */
export interface IResidentClientData {
  resident: IResidentLivePayload;
}

/**
 * Everything the resident live page needs in one call (E4): the token for the
 * socket, their route's geometry (they cannot call the admin routes API), their
 * own pin, and whatever the truck was doing at the moment they opened it — so
 * the map is never blank while waiting for the next fix.
 */
export interface IResidentLiveSession {
  token: string;
  expiresInSeconds: number;
  routeId: number;
  routeName: string;
  segments: IDriverRouteSegment[];
  home: { latitude: number; longitude: number };
  /** True when a driver has a live session open on this route right now. */
  active: boolean;
  startedAt: string | null;
  lastPosition: ITruckPositionEvent | null;
}

export interface IDriverRouteSegment {
  streetName: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  path: [number, number][] | null;
}

export interface IRouteStartedEvent {
  truckId: number;
  routeId: number;
  routeName: string;
  startedAt: string;
  segments: IDriverRouteSegment[];
}

export interface ITruckPositionEvent {
  truckId: number;
  routeId: number;
  latitude: number;
  longitude: number;
  segmentIndex: number | null;
  streetName: string | null;
  timestamp: string;
}

/**
 * Latest fix per truck for the admin map's initial paint. Mirrors the socket's
 * ITruckPositionEvent so the client can merge the two without special cases —
 * route and street are resolved here because truck_positions stores neither.
 */
export interface ILatestTruckPosition {
  truckId: number;
  routeId: number | null;
  latitude: number;
  longitude: number;
  segmentIndex: number | null;
  streetName: string | null;
  timestamp: Date;
}

export interface IRouteSessionSummary {
  driverId: number;
  driverName: string;
  totalSeconds: number;
  sessions: Array<{
    id: number;
    routeName: string | null;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
    active: boolean;
  }>;
}
