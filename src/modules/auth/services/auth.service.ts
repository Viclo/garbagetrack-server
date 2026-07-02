import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminsService } from '../../admins/services/admins.service';
import { DriversService } from '../../drivers/services/drivers.service';
import { TenantsService } from '../../tenants/services/tenants.service';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IAuthUser, ILoginResponse } from '../interfaces/auth.interface';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly driversService: DriversService,
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<IAuthUser | null> {
    const admin = await this.adminsService.findByUsername(username);
    if (admin?.isActive) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (valid)
        return this.buildAuthUser(
          admin.id,
          admin.username,
          admin.name,
          UserRole.ADMIN,
          admin.tenantId,
        );
    }

    const driver = await this.driversService.findByUsername(username);
    if (driver?.isActive) {
      const valid = await bcrypt.compare(password, driver.passwordHash);
      if (valid)
        return this.buildAuthUser(
          driver.id,
          driver.username,
          driver.name,
          UserRole.DRIVER,
          driver.tenantId,
        );
    }

    return null;
  }

  login(user: IAuthUser): ILoginResponse {
    const payload: IJwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
    };
    return { accessToken: this.jwtService.sign(payload), user };
  }

  private async buildAuthUser(
    id: number,
    username: string,
    name: string,
    role: UserRole,
    tenantId: number,
  ): Promise<IAuthUser> {
    const tenant = await this.tenantsService.findById(tenantId);
    return { id, username, name, role, tenantId, tenantName: tenant?.name ?? '' };
  }
}
