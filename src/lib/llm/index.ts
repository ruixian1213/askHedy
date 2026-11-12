import { chatAnthropic, listAnthropicModels } from './anthropic';
import { chatOpenAICompat, listOpenAICompatModels } from './openaiCompat';
import { LLMRequest, LLMResponse, ProviderConfig } from './types';

export * from './types';

export function chat(req: LLMRequest): Promise<LLMResponse> {
  return req.provider.kind === 'anthropic' ? chatAnthropic(req) : chatOpenAICompat(req);
}

export function listModels(p: ProviderConfig): Promise<string[]> {
  return p.kind === 'anthropic'
    ? listAnthropicModels(p.baseUrl, p.apiKey)
    : listOpenAICompatModels(p.baseUrl, p.apiKey, p.extraHeaders);
}

/** 快速測試連線：送一則極短訊息 */
export async function testProvider(p: ProviderConfig): Promise<string> {
  const r = await chat({
    provider: p,
    messages: [{ role: 'user', content: '請只回覆「OK」兩個字。' }],
    maxTokens: 20,
  });
  return r.text.trim() || '(空回應)';
}
