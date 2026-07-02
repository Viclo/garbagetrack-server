import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Opens the tenant context for every authenticated HTTP request using the
 * tenantId embedded in the JWT. Public endpoints (webhook, health) pass
 * through without a context and must open one explicitly if they touch
 * tenant-owned data.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<{ user?: IJwtPayload }>();
    const tenantId = request.user?.tenantId;
    if (tenantId == null) return next.handle();

    // Subscribe inside als.run so the route handler executes within the context.
    return new Observable((subscriber) => {
      const subscription = this.tenantContext.runWith(tenantId, () =>
        next.handle().subscribe(subscriber),
      );
      return () => subscription.unsubscribe();
    });
  }
}
