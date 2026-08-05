import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ResidentsService } from './residents.service';
import { PushSubscriptionsService } from '../../push/services/push-subscriptions.service';
import { TenantsService } from '../../tenants/services/tenants.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { RegisterResidentInput } from '../dtos/inputs/register-resident.input';
import { RegisterResidentOutput } from '../dtos/outputs/register-resident.output';
import { UnsubscribeResidentInput } from '../dtos/inputs/unsubscribe-resident.input';
import { ResidentStatusInput } from '../dtos/inputs/resident-status.input';
import { ResidentStatusOutput } from '../dtos/outputs/resident-status.output';

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

      // A resident outside every route's collection radius is still registered,
      // but nothing will ever notify them. Report it so the PWA can say so
      // rather than showing "¡Listo!" over silence.
      return { residentId: resident.id, ownerToken, routeAssigned: resident.route != null };
    });
  }

  /**
   * What the device's stored registration is still worth (roadmap C7). The PWA
   * decides it is registered from localStorage alone, so a record an admin
   * deleted or deactivated leaves it showing "¡Listo!" forever with no way back.
   * Also refreshes coverage, which changes whenever routes are redrawn.
   *
   * A missing record and a bad token both answer `unknown`: the device's
   * recovery is identical, and keeping them indistinguishable stops this public
   * endpoint from being used to probe which resident ids exist.
   */
  async status(input: ResidentStatusInput, ownerToken: string): Promise<ResidentStatusOutput> {
    const tenant = await this.tenantsService.findBySlug(input.tenantSlug);
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Municipio no encontrado o no está activo');
    }

    return this.tenantContext.runWith(tenant.id, async () => {
      const authorized = await this.residentsService.verifyOwnerToken(
        input.residentId,
        ownerToken,
      );
      if (!authorized) return { status: 'unknown', routeAssigned: false };

      const state = await this.residentsService.findRegistrationState(input.residentId);
      if (!state) return { status: 'unknown', routeAssigned: false };

      return {
        status: state.isActive ? 'active' : 'inactive',
        routeAssigned: state.routeAssigned,
      };
    });
  }

  /**
   * Self-service unsubscribe (roadmap B3). Authorized ONLY by the device's
   * owner token (Option A) — knowing a resident id is never enough. Deactivates
   * the resident and all their push subscriptions.
   */
  async unregister(input: UnsubscribeResidentInput, ownerToken: string): Promise<void> {
    const tenant = await this.tenantsService.findBySlug(input.tenantSlug);
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Municipio no encontrado o no está activo');
    }

    await this.tenantContext.runWith(tenant.id, async () => {
      const authorized = await this.residentsService.verifyOwnerToken(
        input.residentId,
        ownerToken,
      );
      if (!authorized) {
        throw new ForbiddenException('No autorizado para dar de baja este registro');
      }

      await this.residentsService.deactivateById(input.residentId);
      await this.pushSubscriptionsService.deactivateByResident(input.residentId);
    });
  }
}
