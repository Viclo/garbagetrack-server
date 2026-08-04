import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicTenantService } from '../services/public-tenant.service';
import { IPublicTenant } from '../interfaces/tenant.interface';

/**
 * Public municipality lookup for the resident PWA (no JWT) — lets the QR
 * landing page name the municipality and show its phone number. Rate-limited
 * per IP like the other public endpoints (B5).
 */
@ApiTags('tenants-public')
@UseGuards(ThrottlerGuard)
@Controller('public/tenants')
export class PublicTenantsController {
  constructor(private readonly publicTenantService: PublicTenantService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':slug')
  @ApiOperation({ summary: 'Public municipality info for the registration page' })
  findBySlug(@Param('slug') slug: string): Promise<IPublicTenant> {
    return this.publicTenantService.findBySlug(slug);
  }
}
