import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { IPublicTenant } from '../interfaces/tenant.interface';

/**
 * The slice of a municipality the public registration page may read. Resolves
 * the tenant from the QR slug and opens its context manually, exactly as the
 * public resident endpoints do — there is no JWT to carry the tenant.
 *
 * Deliberately narrow: name and contact phone only. This endpoint is
 * unauthenticated, so anything added here becomes public.
 */
@Injectable()
export class PublicTenantService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async findBySlug(slug: string): Promise<IPublicTenant> {
    const tenant = await this.tenantsService.findBySlug(slug);
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Municipio no encontrado o no está activo');
    }

    return this.tenantContext.runWith(tenant.id, async () => {
      const contactPhone = await this.systemConfigService.get('contact_phone');
      return {
        name: tenant.name,
        // Empty means the admin has not set one; the page omits the line.
        contactPhone: contactPhone?.trim() ? contactPhone.trim() : null,
      };
    });
  }
}
