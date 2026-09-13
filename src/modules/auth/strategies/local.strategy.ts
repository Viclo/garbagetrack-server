import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { IAuthUser } from '../interfaces/auth.interface';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'username', passReqToCallback: true });
  }

  /**
   * `passReqToCallback` is on solely to read X-Tenant-Slug — the subdomain the
   * login request came from — so AuthService can scope the username lookup to
   * that municipality (roadmap A1/A3) instead of matching globally.
   */
  async validate(req: Request, username: string, password: string): Promise<IAuthUser> {
    const tenantSlugHeader = req.headers['x-tenant-slug'];
    const tenantSlug = Array.isArray(tenantSlugHeader) ? tenantSlugHeader[0] : tenantSlugHeader;
    const user = await this.authService.validateUser(username, password, tenantSlug);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
