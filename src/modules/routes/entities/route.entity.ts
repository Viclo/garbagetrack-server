import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RouteSegment } from './route-segment.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null = null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => RouteSegment, (segment) => segment.route, { cascade: true })
  segments!: RouteSegment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
