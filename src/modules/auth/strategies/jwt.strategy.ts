import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('app.jwtSecret'),
    });
  }

  async validate(payload: IJwtPayload): Promise<IJwtPayload> {
    // A valid signature is not enough: the account and its tenant must still
    // be active, otherwise a 7-day token outlives a deactivation.
    const active = await this.authService.verifyActiveUser(payload);
    if (!active) throw new UnauthorizedException('Account is disabled or no longer exists');
    return payload;
  }
}
