import { UserRole } from '../enums/user-role.enum';

export interface IJwtPayload {
  sub: number;
  username: string;
  role: UserRole;
  tenantId: number;
}
