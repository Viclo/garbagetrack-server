/**
 * Events sent to the frontend over SSE. `meta` always arrives first so the
 * client learns the conversation id before any text (needed when the message
 * starts a new conversation).
 */
export type AssistantSseEvent =
  | { type: 'meta'; conversationId: number }
  | { type: 'text_delta'; text: string }
  | {
      type: 'done';
      messageId: number | null;
      inputTokens: number | null;
      outputTokens: number | null;
    }
  | { type: 'error'; message: string };

export interface IConversationSummary {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}
