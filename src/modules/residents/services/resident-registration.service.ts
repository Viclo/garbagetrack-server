import { Injectable, NotFoundException } from '@nestjs/common';
import { ResidentsService } from './residents.service';
import { PushSubscriptionsService } from '../../push/services/push-subscriptions.service';
import { TenantsService } from '../../tenants/services/tenants.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { RegisterResidentInput } from '../dtos/inputs/register-resident.input';
import { RegisterResidentOutput } from '../dtos/outputs/register-resident.output';

/**
 * Orchestrates the public resident registration (roadmap B1): resolve the
 * tenant from the QR slug, then, inside that tenant's context, create a fresh
 * device-owned resident, mint its owner token, and store the push subscription.
 * Kept separate from ResidentsService so the admin-facing service stays free of
 * the public flow's cross-module wiring (push, tenants).
 */
@Injectable()
export class ResidentRegistrationService {
  constructor(
    private readonly residentsService: ResidentsService,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async register(input: RegisterResidentInput): Promise<RegisterResidentOutput> {
    // Public endpoint: no JWT, so resolve and open the tenant context manually
    // from the slug the QR carried.
    const tenant = await this.tenantsService.findBySlug(input.tenantSlug);
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Municipio no encontrado o no está activo');
    }

    return this.tenantContext.runWith(tenant.id, async () => {
      const resident = await this.residentsService.register(
        input.phoneNumber,
        input.latitude,
        input.longitude,
        input.name ?? null,
      );

      const ownerToken = await this.residentsService.issueOwnerToken(resident.id);

      await this.pushSubscriptionsService.upsert(resident.id, {
        endpoint: input.pushSubscription.endpoint,
        p256dh: input.pushSubscription.p256dh,
        auth: input.pushSubscription.auth,
      });

      return { residentId: resident.id, ownerToken };
    });
  }
}
