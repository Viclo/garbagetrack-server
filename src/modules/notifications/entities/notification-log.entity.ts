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

  @Column({ name: 'message_status', default: 'sent' })
  messageStatus!: string;

  @Column({ name: 'wa_message_id', type: 'varchar', nullable: true })
  waMessageId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
