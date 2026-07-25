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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
