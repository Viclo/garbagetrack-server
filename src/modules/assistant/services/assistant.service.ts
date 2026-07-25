import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage, AiMessageRole } from '../entities/ai-message.entity';
import { SendMessageInput } from '../dtos/inputs/send-message.input';
import { ILlmClient, ILlmMessage, LLM_CLIENT } from '../interfaces/llm-client.interface';
import { AssistantSseEvent, IConversationSummary } from '../interfaces/assistant-event.interface';
import { buildSystemPrompt } from '../prompts/system.prompt';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';

const HISTORY_LIMIT = 15;
const TITLE_MAX_LENGTH = 60;

@Injectable()
export class AssistantService {
  constructor(
    @InjectRepository(AiConversation)
    private readonly conversationsRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messagesRepo: Repository<AiMessage>,
    @Inject(LLM_CLIENT) private readonly llmClient: ILlmClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Runs one chat turn: persists the user message, streams the model reply
   * and persists whatever text was produced — also on abort/error, so a
   * partial answer the user already saw survives a reload.
   */
  async *chatStream(user: IJwtPayload, input: SendMessageInput): AsyncGenerator<AssistantSseEvent> {
    const conversation = await this.resolveConversation(user, input);
    yield { type: 'meta', conversationId: conversation.id };

    await this.messagesRepo.save(
      this.messagesRepo.create({
        conversationId: conversation.id,
        role: AiMessageRole.USER,
        content: input.message,
      }),
    );

    const history = await this.loadHistory(conversation.id);
    let fullText = '';
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let savedMessageId: number | null = null;

    try {
      const stream = this.llmClient.chatStream({
        system: buildSystemPrompt({ username: user.username, role: user.role }),
        messages: history,
      });
      for await (const event of stream) {
        if (event.type === 'text_delta') {
          fullText += event.text;
          yield { type: 'text_delta', text: event.text };
        } else if (event.type === 'usage') {
          inputTokens = event.inputTokens;
          outputTokens = event.outputTokens;
        }
      }
    } finally {
      if (fullText.length > 0) {
        const saved = await this.messagesRepo.save(
          this.messagesRepo.create({
            conversationId: conversation.id,
            role: AiMessageRole.ASSISTANT,
            content: fullText,
            inputTokens,
            outputTokens,
          }),
        );
        savedMessageId = saved.id;
        conversation.updatedAt = new Date();
        await this.conversationsRepo.save(conversation);
      }
    }

    yield { type: 'done', messageId: savedMessageId, inputTokens, outputTokens };
  }

  async listConversations(user: IJwtPayload): Promise<IConversationSummary[]> {
    return this.conversationsRepo.find({
      select: ['id', 'title', 'createdAt', 'updatedAt'],
      where: { adminId: user.sub, tenantId: this.tenantContext.tenantId },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
  }

  async getMessages(user: IJwtPayload, conversationId: number): Promise<AiMessage[]> {
    await this.findOwnedConversation(user, conversationId);
    return this.messagesRepo.find({
      where: { conversationId },
      order: { id: 'ASC' },
    });
  }

  async deleteConversation(user: IJwtPayload, conversationId: number): Promise<void> {
    const conversation = await this.findOwnedConversation(user, conversationId);
    await this.conversationsRepo.remove(conversation);
  }

  private async resolveConversation(
    user: IJwtPayload,
    input: SendMessageInput,
  ): Promise<AiConversation> {
    if (input.conversationId != null) {
      return this.findOwnedConversation(user, input.conversationId);
    }
    const title =
      input.message.length > TITLE_MAX_LENGTH
        ? `${input.message.slice(0, TITLE_MAX_LENGTH - 1)}…`
        : input.message;
    return this.conversationsRepo.save(
      this.conversationsRepo.create({
        adminId: user.sub,
        tenantId: this.tenantContext.tenantId,
        title,
      }),
    );
  }

  private async findOwnedConversation(
    user: IJwtPayload,
    conversationId: number,
  ): Promise<AiConversation> {
    const conversation = await this.conversationsRepo.findOne({
      where: {
        id: conversationId,
        adminId: user.sub,
        tenantId: this.tenantContext.tenantId,
      },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    return conversation;
  }

  private async loadHistory(conversationId: number): Promise<ILlmMessage[]> {
    const recent = await this.messagesRepo.find({
      where: { conversationId },
      order: { id: 'DESC' },
      take: HISTORY_LIMIT,
    });
    const chronological = recent.reverse();
    // Gemini expects the first content to be a user turn; trimming can leave
    // an assistant message first.
    while (chronological.length && chronological[0].role !== AiMessageRole.USER) {
      chronological.shift();
    }
    return chronological.map((message) => ({
      role: message.role === AiMessageRole.USER ? 'user' : 'assistant',
      content: message.content,
    }));
  }
}
