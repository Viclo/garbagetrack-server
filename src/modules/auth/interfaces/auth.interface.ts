import { UserRole } from '../../../common/enums/user-role.enum';

export interface IAuthUser {
  id: number;
  username: string;
  role: UserRole;
  name: string;
  tenantId: number;
  tenantName: string;
}

export interface ILoginResponse {
  accessToken: string;
  user: IAuthUser;
}
