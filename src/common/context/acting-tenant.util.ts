import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { TenantsService } from '../../modules/tenants/services/tenants.service';

/**
 * Resolves a SUPER_ADMIN's request to act inside another municipality's tenant
 * context. Shared by TenantContextInterceptor (REST) and TrackingGateway
 * (WebSocket) so the same security check — role gate + active-tenant lookup —
 * isn't duplicated and can't drift between the two entry points.
 *
 * Returns null when there is nothing to override (no requested id, or the
 * caller isn't SUPER_ADMIN — in which case the id is silently ignored rather
 * than trusted, since only a SUPER_ADMIN's own JWT role proves the right to
 * act as another tenant).
 */
export async function resolveActingTenantId(
  tenantsService: TenantsService,
  role: UserRole,
  requestedTenantId: number | undefined | null,
): Promise<number | null> {
  if (role !== UserRole.SUPER_ADMIN || requestedTenantId == null) return null;
  if (!Number.isFinite(requestedTenantId)) return null;

  const tenant = await tenantsService.findById(requestedTenantId);
  if (!tenant?.isActive) {
    throw new ForbiddenException(`Municipality ${requestedTenantId} not found or inactive`);
  }
  return tenant.id;
}
