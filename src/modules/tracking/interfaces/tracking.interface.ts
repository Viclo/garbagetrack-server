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
