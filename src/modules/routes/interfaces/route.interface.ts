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
  segments: IRouteSegment[];
  createdAt: Date;
  updatedAt: Date;
}
