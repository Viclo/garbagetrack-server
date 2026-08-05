/**
 * Where a resident meets the truck (B7): the nearest point on a route's
 * centerline, how far along the route it sits, and how far they walk to it.
 */
export interface ICollectionPoint {
  routeId: number;
  segmentIndex: number | null;
  streetName: string | null;
  offsetM: number;
  distanceM: number;
}

export interface IResident {
  id: number;
  phoneNumber: string;
  name: string | null;
  latitude: number;
  longitude: number;
  routeId: number | null;
  segmentIndex: number | null;
  /** Walking distance from the house to the route; null when unassigned (B7). */
  distanceToRouteM: number | null;
  /** Metres along the route where the truck reaches them — drives every ETA. */
  routeOffsetM: number | null;
  /** Route and street names, so the dashboard can show why the pin was assigned (E5). */
  routeName: string | null;
  streetName: string | null;
  /** True when an admin set the route by hand; automatic reassignment skips it. */
  routeLocked: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
