export interface INearestSegmentResult {
  routeId: number;
  segmentIndex: number;
  streetName: string;
}

export interface IRouteSegment {
  id: number;
  segmentIndex: number;
  streetName: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  path: [number, number][] | null;
}

export interface IRoute {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Identity colour on admin maps (one of ROUTE_COLORS). */
  color: string;
  /** True when an administrator chose the colour; false when automatic. */
  colorLocked: boolean;
  segments: IRouteSegment[];
  createdAt: Date;
  updatedAt: Date;
}
