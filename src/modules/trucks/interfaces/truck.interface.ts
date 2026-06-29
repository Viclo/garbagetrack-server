import { IDriver } from '../../drivers/interfaces/driver.interface';

export interface ITruck {
  id: number;
  name: string;
  licensePlate: string;
  driver: Pick<IDriver, 'id' | 'name' | 'username'> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
