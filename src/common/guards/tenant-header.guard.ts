import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Defense-in-depth, not a data-isolation fix: TenantContextService already
 * scopes every query by the JWT's tenantId regardless of this guard. This only
 * catches a client sending an X-Tenant-Slug that disagrees with the tenant its
 * own JWT was issued for (e.g. a stale tab left open on a different
 * municipality's subdomain) and fails loudly instead of the request silently
 * running under the JWT's tenant while the UI thinks it's on another one
 * (roadmap A5).
 */
@Injectable()
export class TenantHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: IJwtPayload; headers: Record<string, string | string[] | undefined> }>();

    const headerSlug = request.headers['x-tenant-slug'];
    if (!headerSlug || !request.user) return true; // public route, or client didn't send it

    const slug = Array.isArray(headerSlug) ? headerSlug[0] : headerSlug;
    if (slug !== request.user.tenantSlug) {
      throw new ForbiddenException('Tenant mismatch between session and current host');
    }
    return true;
  }
}
