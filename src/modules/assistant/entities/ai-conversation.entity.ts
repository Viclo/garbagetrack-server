import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Admin } from '../../admins/entities/admin.entity';

@Entity('ai_conversations')
export class AiConversation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  @ManyToOne(() => Admin, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id' })
  admin!: Admin;

  @Column({ name: 'admin_id' })
  adminId!: number;

  @Column()
  title!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
