export interface IAdmin {
  id: number;
  tenantId: number;
  username: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminWithPassword extends IAdmin {
  passwordHash: string;
}
