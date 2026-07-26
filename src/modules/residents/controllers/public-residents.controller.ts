import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { ResidentRegistrationService } from '../services/resident-registration.service';
import { RegisterResidentInput } from '../dtos/inputs/register-resident.input';
import { RegisterResidentOutput } from '../dtos/outputs/register-resident.output';
import { UnsubscribeResidentInput } from '../dtos/inputs/unsubscribe-resident.input';

/**
 * Public resident endpoints for the PWA (no JWT). Tenant is resolved from the
 * body's slug, not a token. Create-only here; owner-token-gated actions
 * (unsubscribe) arrive in B3.
 *
 * Rate-limited per IP (B5). The limit is deliberately generous: Bolivian mobile
 * carriers use CGNAT, so many legitimate residents can share one public IP —
 * too tight a cap would block a neighborhood registering during a campaign. If
 * abuse appears, add a CAPTCHA rather than lowering this further.
 */
@ApiTags('residents-public')
@UseGuards(ThrottlerGuard)
@Controller('public/residents')
export class PublicResidentsController {
  constructor(private readonly registrationService: ResidentRegistrationService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a resident from the PWA (share-once + push subscription)' })
  register(@Body() input: RegisterResidentInput): Promise<RegisterResidentOutput> {
    return this.registrationService.register(input);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'x-owner-token', required: true, description: 'Device owner token' })
  @ApiOperation({ summary: 'Unsubscribe a resident (owner-token gated)' })
  async unsubscribe(
    @Body() input: UnsubscribeResidentInput,
    @Headers('x-owner-token') ownerToken?: string,
  ): Promise<{ success: true }> {
    if (!ownerToken) {
      throw new ForbiddenException('Falta el token de propietario');
    }
    await this.registrationService.unregister(input, ownerToken);
    return { success: true };
  }
}
