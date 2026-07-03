import { UserRole } from '../../../common/enums/user-role.enum';

export interface IAdmin {
  id: number;
  tenantId: number;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminWithPassword extends IAdmin {
  passwordHash: string;
}
