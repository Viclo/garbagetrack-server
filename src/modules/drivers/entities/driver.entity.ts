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

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: number;

  // Usernames stay globally unique so login does not need a tenant selector.
  @Column({ unique: true })
  username!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'varchar' })
  phone!: string | null;

  @Column({ name: 'license_number', nullable: true, type: 'varchar' })
  licenseNumber!: string | null;

  /**
   * When the driver's licence stops being valid (YYYY-MM-DD).
   *
   * A `date`, not a timestamp: a licence expires on a calendar day in the
   * municipality, and a timestamp would make it expire at a UTC hour that falls
   * on the previous day locally. Null means nobody has recorded one yet, which
   * the admin list flags as pending rather than as expired.
   */
  @Column({ name: 'license_expires_at', nullable: true, type: 'date' })
  licenseExpiresAt!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
