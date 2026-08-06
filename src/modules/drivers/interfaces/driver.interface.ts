export interface IDriver {
  id: number;
  tenantId: number;
  username: string;
  name: string;
  phone: string | null;
  licenseNumber: string | null;
  /** Calendar day the licence lapses (YYYY-MM-DD); null when not recorded. */
  licenseExpiresAt: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDriverWithPassword extends IDriver {
  passwordHash: string;
}
