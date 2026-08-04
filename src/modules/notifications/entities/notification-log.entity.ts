import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity';
import { Route } from '../../routes/entities/route.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @ManyToOne(() => Resident, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident!: Resident;

  @ManyToOne(() => Route, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route!: Route;

  @Column({ name: 'sent_at', type: 'date' })
  sentAt!: string;

  /** Delivery channel — 'push' now that WhatsApp is retired. Kept for analytics. */
  @Column({ default: 'push' })
  channel!: string;

  /**
   * Which of the day's two alerts this was (B8): 'prepare' (~20 minutes out)
   * or 'arriving' (the truck is at the resident's street). Part of the daily
   * dedup key, so one stage never suppresses the other.
   */
  @Column({ default: 'prepare' })
  stage!: string;

  @Column({ name: 'message_status', default: 'sent' })
  messageStatus!: string;

  /** Channel-neutral provider id. Null for Web Push (it returns no message id). */
  @Column({ name: 'provider_message_id', type: 'varchar', nullable: true })
  providerMessageId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
