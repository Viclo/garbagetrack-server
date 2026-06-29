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
