import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Resident } from '../../residents/entities/resident.entity';

/**
 * A browser Web Push subscription owned by a resident. A resident may hold
 * several (phone browser + home browser), so alerts fan out to all active
 * rows; dead ones are deactivated when the push service returns 404/410 (A4).
 * The endpoint is globally unique — it already carries a per-device token.
 */
@Entity('push_subscriptions')
@Unique(['endpoint'])
export class PushSubscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @Index()
  @ManyToOne(() => Resident, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident!: Resident;

  @Column({ name: 'resident_id' })
  residentId!: number;

  /** Full push-service URL from PushSubscription.endpoint; long, so TEXT. */
  @Column({ type: 'text' })
  endpoint!: string;

  /** Client public key (base64url) from subscription.keys.p256dh. */
  @Column()
  p256dh!: string;

  /** Client auth secret (base64url) from subscription.keys.auth. */
  @Column()
  auth!: string;

  /** 'web' for the PWA; kept flexible for a future native resident app. */
  @Column({ default: 'web' })
  platform!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
