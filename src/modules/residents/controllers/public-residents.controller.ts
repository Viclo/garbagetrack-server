import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ResidentRegistrationService } from '../services/resident-registration.service';
import { RegisterResidentInput } from '../dtos/inputs/register-resident.input';
import { RegisterResidentOutput } from '../dtos/outputs/register-resident.output';

/**
 * Public resident endpoints for the PWA (no JWT). Tenant is resolved from the
 * body's slug, not a token. Create-only here; owner-token-gated actions
 * (unsubscribe) arrive in B3.
 */
@ApiTags('residents-public')
@Controller('public/residents')
export class PublicResidentsController {
  constructor(private readonly registrationService: ResidentRegistrationService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a resident from the PWA (share-once + push subscription)' })
  register(@Body() input: RegisterResidentInput): Promise<RegisterResidentOutput> {
    return this.registrationService.register(input);
  }
}
