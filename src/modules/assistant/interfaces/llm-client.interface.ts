export interface ILlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ILlmChatParams {
  system: string;
  messages: ILlmMessage[];
}

export type LlmStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number };

export interface ILlmClient {
  chatStream(params: ILlmChatParams): AsyncGenerator<LlmStreamEvent>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
