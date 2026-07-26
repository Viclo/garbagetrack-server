import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from '../entities/push-subscription.entity';
import { IPushSubscription } from '../interfaces/push.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@Injectable()
export class PushSubscriptionsService {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Store (or revive) a resident's subscription, keyed by its globally-unique
   * endpoint. Re-subscribing the same browser refreshes the keys and reactivates
   * the row instead of creating a duplicate. Runs within the resident's tenant
   * context (opened by the public register endpoint, B1).
   */
  async upsert(
    residentId: number,
    subscription: IPushSubscription,
    platform = 'web',
  ): Promise<PushSubscription> {
    const tenantId = this.tenantContext.tenantId;
    const existing = await this.repo.findOne({ where: { endpoint: subscription.endpoint } });

    if (existing) {
      existing.tenantId = tenantId;
      existing.residentId = residentId;
      existing.p256dh = subscription.p256dh;
      existing.auth = subscription.auth;
      existing.platform = platform;
      existing.isActive = true;
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        tenantId,
        residentId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        platform,
        isActive: true,
      }),
    );
  }

  /** Active subscriptions to fan an alert out to (roadmap A3). */
  findActiveByResident(residentId: number): Promise<PushSubscription[]> {
    return this.repo.find({ where: { residentId, isActive: true } });
  }

  /**
   * Deactivate a single subscription by endpoint. Called when a send returns
   * 404/410 Gone — the browser revoked it or the PWA was removed (A4). Not
   * tenant-scoped: the endpoint is globally unique and the caller already holds
   * a valid reference to it.
   */
  async deactivateByEndpoint(endpoint: string): Promise<void> {
    await this.repo.update({ endpoint }, { isActive: false });
  }

  /** Deactivate all of a resident's subscriptions (self-unsubscribe, B3). */
  async deactivateByResident(residentId: number): Promise<void> {
    await this.repo.update(
      { residentId, tenantId: this.tenantContext.tenantId },
      { isActive: false },
    );
  }
}
