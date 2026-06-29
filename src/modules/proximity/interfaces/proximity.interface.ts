export interface IProximityTrigger {
  truckId: number;
  routeId: number;
  currentSegmentIndex: number;
  targetSegmentIndex: number;
  currentStreetName: string;
}
