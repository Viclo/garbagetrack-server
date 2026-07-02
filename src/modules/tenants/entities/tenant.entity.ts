import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn()
  id!: number;

  /** URL-safe identifier, e.g. "cochabamba". The bootstrap tenant is "default". */
  @Column({ unique: true })
  slug!: string;

  /** Display name of the municipality/enterprise. */
  @Column()
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /**
   * Meta WhatsApp Business credentials for this municipality. When null the
   * platform falls back to the WHATSAPP_* env credentials (single-tenant mode).
   */
  @Column({ name: 'wa_phone_number_id', type: 'varchar', nullable: true, unique: true })
  waPhoneNumberId!: string | null;

  @Column({ name: 'wa_access_token', type: 'varchar', nullable: true })
  waAccessToken!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
