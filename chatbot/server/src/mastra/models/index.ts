import { createOpenAI } from '@ai-sdk/openai';
import { MockLanguageModelV4 } from 'ai/test';

/**
 * Creates a mock language model for offline/testing and database-free unit boots.
 */
export function createMockModel(defaultText = '{"status":"APPROVED","match_score":92.5,"assessment":"Candidate exhibits strong qualifications."}') {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: defaultText }],
      text: defaultText,
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

/**
 * Dynamic model resolution occurring at call time inside instance.ts accessors.
 * If AVALAI_API_KEY is configured and not in test mode, returns AvalAI DeepSeek V4.1 Flash.
 * Otherwise returns a deterministic mock model.
 */
export function resolveModel(defaultText?: string) {
  const apiKey = process.env.AVALAI_API_KEY;
  const isTest = process.env.NODE_ENV === 'test' || !apiKey || apiKey === 'mock-key';

  if (isTest) {
    return createMockModel(defaultText);
  }

  const avalai = createOpenAI({
    baseURL: process.env.AVALAI_BASE_URL || 'https://api.avalai.ir/v1',
    apiKey,
  });

  return avalai('deepseek-v4.1-flash');
}

/**
 * Static boot model used strictly during module initialization in agents/index.ts.
 * Guarantees zero network calls or credential errors during static module import.
 */
export function getAgentModel() {
  if (process.env.NODE_ENV === 'test' || !process.env.AVALAI_API_KEY) {
    return createMockModel();
  }
  return resolveModel();
}
