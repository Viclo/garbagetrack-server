import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { TenantContextService } from './tenant-context.service';
import { TenantsService } from '../../modules/tenants/services/tenants.service';
import { resolveActingTenantId } from './acting-tenant.util';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';

const ACTING_TENANT_HEADER = 'x-acting-tenant-id';

/**
 * Opens the tenant context for every authenticated HTTP request using the
 * tenantId embedded in the JWT. Public endpoints (webhook, health) pass
 * through without a context and must open one explicitly if they touch
 * tenant-owned data.
 *
 * A SUPER_ADMIN may override which tenant the request runs against via
 * X-Acting-Tenant-Id (roadmap: cross-tenant platform console) — this is how a
 * super-admin "views as" a municipality using the exact same tenant-scoped
 * endpoints a municipal admin uses, without a second login/token. See
 * resolveActingTenantId for the validation (and why any other role's header
 * is ignored, never trusted).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantsService: TenantsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<{ user?: IJwtPayload; headers: Record<string, string | string[] | undefined> }>();
    const user = request.user;
    if (user?.tenantId == null) return next.handle();

    const rawHeader = request.headers[ACTING_TENANT_HEADER];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const parsed = headerValue != null ? Number(headerValue) : undefined;
    const requestedTenantId = parsed != null && Number.isFinite(parsed) ? parsed : undefined;

    return from(resolveActingTenantId(this.tenantsService, user.role, requestedTenantId)).pipe(
      switchMap((actingTenantId) => {
        const tenantId = actingTenantId ?? user.tenantId;
        // Subscribe inside als.run so the route handler executes within the context.
        return new Observable((subscriber) => {
          const subscription = this.tenantContext.runWith(tenantId, () =>
            next.handle().subscribe(subscriber),
          );
          return () => subscription.unsubscribe();
        });
      }),
    );
  }
}
