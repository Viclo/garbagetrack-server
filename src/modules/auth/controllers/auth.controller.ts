import { Controller, Post, Get, UseGuards, HttpCode, HttpStatus, Body, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiHeader, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { IAuthUser } from '../interfaces/auth.interface';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { LoginInput } from '../dtos/inputs/login.input';
import { LoginOutput, AuthUserOutput } from '../dtos/outputs/login.output';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate admin or driver and receive a JWT' })
  @ApiBody({ type: LoginInput })
  @ApiHeader({
    name: 'x-tenant-slug',
    required: false,
    description:
      'Municipality subdomain the request came from. Scopes the username lookup to that tenant; ' +
      'omitted (e.g. logging in from the bare apex) falls back to a global lookup, and the client ' +
      'is expected to redirect to the returned tenantSlug\'s own subdomain afterward.',
  })
  login(@Body() _loginInput: LoginInput, @CurrentUser() user: IAuthUser): LoginOutput {
    return this.authService.login(user);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthUserOutput })
  @ApiOperation({
    summary:
      "Rehydrate the current token holder's full profile (name, tenantName) " +
      'from the JWT alone — used after a cross-subdomain login redirect, where the ' +
      "frontend's cached profile cookie does not reliably follow the token (roadmap C2).",
  })
  async me(@CurrentUser() payload: IJwtPayload): Promise<IAuthUser> {
    const user = await this.authService.me(payload);
    if (!user) throw new NotFoundException('Account is disabled or no longer exists');
    return user;
  }
}
