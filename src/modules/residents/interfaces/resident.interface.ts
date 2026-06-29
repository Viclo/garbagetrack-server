export interface IResident {
  id: number;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  routeId: number | null;
  segmentIndex: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
