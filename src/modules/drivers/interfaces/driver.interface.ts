export interface IDriver {
  id: number;
  username: string;
  name: string;
  phone: string | null;
  licenseNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDriverWithPassword extends IDriver {
  passwordHash: string;
}
