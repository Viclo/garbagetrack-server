import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ILlmClient, ILlmChatParams, LlmStreamEvent } from '../../interfaces/llm-client.interface';

/**
 * Only file in the codebase that imports @google/genai. Everything else
 * talks to ILlmClient.
 */
@Injectable()
export class GeminiProvider implements ILlmClient {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenAI | null;
  private readonly model: string;
  private readonly maxOutputTokens: number;
  private readonly thinkingLevel: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('gemini.apiKey');
    this.client = apiKey
      ? new GoogleGenAI({
          apiKey,
          httpOptions: { timeout: config.get<number>('gemini.timeoutMs') },
        })
      : null;
    this.model = config.get<string>('gemini.model') ?? 'gemini-3.6-flash';
    this.maxOutputTokens = config.get<number>('gemini.maxOutputTokens') ?? 1024;
    this.thinkingLevel = config.get<string>('gemini.thinkingLevel') ?? 'low';
    if (!this.client) {
      this.logger.warn('GEMINI_API_KEY not set — assistant endpoints will respond 503');
    }
  }

  async *chatStream(params: ILlmChatParams): AsyncGenerator<LlmStreamEvent> {
    if (!this.client) {
      throw new ServiceUnavailableException('El asistente de IA no está configurado');
    }

    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: params.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      config: {
        systemInstruction: params.system,
        maxOutputTokens: this.maxOutputTokens,
        // Gemini 3 cannot disable thinking; "low" is the cheapest level.
        thinkingConfig: { thinkingLevel: this.thinkingLevel as ThinkingLevel },
      },
    });

    let inputTokens = 0;
    let outputTokens = 0;
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield { type: 'text_delta', text };
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
      }
    }
    yield { type: 'usage', inputTokens, outputTokens };
  }
}
