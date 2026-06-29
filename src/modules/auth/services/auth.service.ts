import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminsService } from '../../admins/services/admins.service';
import { DriversService } from '../../drivers/services/drivers.service';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IAuthUser, ILoginResponse } from '../interfaces/auth.interface';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly driversService: DriversService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<IAuthUser | null> {
    const admin = await this.adminsService.findByUsername(username);
    if (admin?.isActive) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (valid)
        return { id: admin.id, username: admin.username, name: admin.name, role: UserRole.ADMIN };
    }

    const driver = await this.driversService.findByUsername(username);
    if (driver?.isActive) {
      const valid = await bcrypt.compare(password, driver.passwordHash);
      if (valid)
        return {
          id: driver.id,
          username: driver.username,
          name: driver.name,
          role: UserRole.DRIVER,
        };
    }

    return null;
  }

  login(user: IAuthUser): ILoginResponse {
    const payload: IJwtPayload = { sub: user.id, username: user.username, role: user.role };
    return { accessToken: this.jwtService.sign(payload), user };
  }
}
