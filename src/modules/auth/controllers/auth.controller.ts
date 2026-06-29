import { Controller, Post, UseGuards, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { IAuthUser } from '../interfaces/auth.interface';
import { LoginInput } from '../dtos/inputs/login.input';
import { LoginOutput } from '../dtos/outputs/login.output';

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
  login(@Body() _loginInput: LoginInput, @CurrentUser() user: IAuthUser): LoginOutput {
    return this.authService.login(user);
  }
}
