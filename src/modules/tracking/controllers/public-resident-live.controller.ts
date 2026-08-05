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
import { ResidentLiveService } from '../services/resident-live.service';
import { ResidentLiveInput } from '../dtos/inputs/resident-live.input';
import { IResidentLiveSession } from '../interfaces/tracking.interface';

/**
 * The resident's way into the live truck feed (roadmap E4). Public like the
 * rest of the resident flow — authorization is the device's owner token, not a
 * JWT — and rate-limited for the same CGNAT reasons.
 */
@ApiTags('residents-public')
@UseGuards(ThrottlerGuard)
@Controller('public/residents')
export class PublicResidentLiveController {
  constructor(private readonly residentLiveService: ResidentLiveService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('live')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'x-owner-token', required: true, description: 'Device owner token' })
  @ApiOperation({
    summary: "Open a live view of the resident's own route (owner-token gated)",
  })
  live(
    @Body() input: ResidentLiveInput,
    @Headers('x-owner-token') ownerToken?: string,
  ): Promise<IResidentLiveSession> {
    if (!ownerToken) throw new ForbiddenException('Falta el token de propietario');
    return this.residentLiveService.createSession(input, ownerToken);
  }
}
