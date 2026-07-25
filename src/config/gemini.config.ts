import { registerAs } from '@nestjs/config';

export const geminiConfig = registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS ?? '60000', 10),
  maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? '1024', 10),
  // Gemini 3 cannot disable thinking; it takes a level instead of a token
  // budget. "low" is the cheapest allowed setting.
  thinkingLevel: process.env.GEMINI_THINKING_LEVEL ?? 'low',
}));
