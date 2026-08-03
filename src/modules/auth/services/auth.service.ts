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
        return this.buildAuthUser(admin.id, admin.username, admin.name, admin.role, admin.tenantId);
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

  /**
   * Re-checks a token holder against the database: the account and its tenant
   * must still exist and be active. Called on every authenticated request and
   * on every socket connection, so deactivating a user (or suspending a
   * municipality) revokes access immediately instead of when the 7-day token
   * expires.
   */
  async verifyActiveUser(payload: IJwtPayload): Promise<boolean> {
    const user =
      payload.role === UserRole.DRIVER
        ? await this.driversService.findByIdForAuth(payload.sub)
        : await this.adminsService.findByIdForAuth(payload.sub);
    if (!user?.isActive) return false;

    const tenant = await this.tenantsService.findById(user.tenantId);
    return tenant?.isActive ?? false;
  }

  private async buildAuthUser(
    id: number,
    username: string,
    name: string,
    role: UserRole,
    tenantId: number,
  ): Promise<IAuthUser | null> {
    const tenant = await this.tenantsService.findById(tenantId);
    // A suspended municipality blocks login for all of its users.
    if (!tenant?.isActive) return null;
    return { id, username, name, role, tenantId, tenantName: tenant.name, tenantSlug: tenant.slug };
  }
}
