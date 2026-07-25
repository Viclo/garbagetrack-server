import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface ITenantStore {
  tenantId: number;
}

/**
 * Request-scoped tenant context backed by AsyncLocalStorage. Populated by
 * TenantContextInterceptor for HTTP requests and explicitly (runWith) by the
 * tracking gateway and the seed script.
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<ITenantStore>();

  runWith<T>(tenantId: number, fn: () => T): T {
    return this.als.run({ tenantId }, fn);
  }

  /** Current tenant id; throws if called outside a tenant context. */
  get tenantId(): number {
    const store = this.als.getStore();
    // tenantId can arrive undefined at runtime from pre-multi-tenant JWTs.
    if (store?.tenantId == null) throw new UnauthorizedException('No tenant in request context');
    return store.tenantId;
  }

  get tenantIdOrNull(): number | null {
    return this.als.getStore()?.tenantId ?? null;
  }
}
