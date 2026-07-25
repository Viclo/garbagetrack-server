import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AiConversation } from './ai-conversation.entity';

export enum AiMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('ai_messages')
export class AiMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => AiConversation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AiConversation;

  @Index()
  @Column({ name: 'conversation_id' })
  conversationId!: number;

  @Column({ type: 'varchar' })
  role!: AiMessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'input_tokens', type: 'int', nullable: true })
  inputTokens!: number | null;

  @Column({ name: 'output_tokens', type: 'int', nullable: true })
  outputTokens!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
