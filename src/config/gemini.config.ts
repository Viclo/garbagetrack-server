import { registerAs } from '@nestjs/config';

export const geminiConfig = registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS ?? '60000', 10),
  maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? '1024', 10),
  // Gemini 2.5 controls thinking with a numeric token budget; 0 disables it —
  // chat/tool-param extraction doesn't need it and it bills.
  thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET ?? '0', 10),
  // Gemini 3 dropped the numeric budget for a level and CANNOT disable thinking;
  // "low" is the cheapest allowed setting. Used only for gemini-3* models.
  thinkingLevel: process.env.GEMINI_THINKING_LEVEL ?? 'low',
}));
