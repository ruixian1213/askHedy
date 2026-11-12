/** 供應商種類：OpenAI 相容（OpenAI / OpenRouter / Groq / DeepSeek / 任何路由器）或 Anthropic Messages API */
export type ProviderKind = 'openai' | 'anthropic';

export type ProviderConfig = {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 可選：額外標頭（例如 OpenRouter 的 HTTP-Referer / X-Title） */
  extraHeaders?: Record<string, string>;
};

export type ProviderPreset = {
  key: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  hint?: string;
  extraHeaders?: Record<string, string>;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'anthropic',
    name: 'Claude (Anthropic)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-opus-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    hint: 'console.anthropic.com 取得 API key',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.1',
    models: ['gpt-5.1', 'gpt-5.1-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
    hint: 'platform.openai.com 取得 API key',
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-opus-5.5',
    models: [
      'anthropic/claude-opus-5.5',
      'anthropic/claude-sonnet-5.5',
      'openai/gpt-5.1',
      'google/gemini-3-pro',
      'deepseek/deepseek-v4',
      'x-ai/grok-5',
    ],
    hint: 'openrouter.ai/keys 取得 API key，可用任何路由模型',
    extraHeaders: { 'HTTP-Referer': 'https://askhedy.app', 'X-Title': 'askHedy' },
  },
  {
    key: 'groq',
    name: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    key: 'custom',
    name: '自訂 OpenAI 相容端點',
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: '',
    models: [],
    hint: 'Ollama、LM Studio、vLLM、New API、One API… 任何 /v1/chat/completions 端點',
  },
];

/** 內部統一的訊息格式，再轉成各供應商的格式 */
export type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string;
      toolCalls?: ToolCall[];
      /** Anthropic 回傳的原始 content blocks（含 thinking），回傳給 API 時原樣帶回 */
      providerRaw?: { provider: 'anthropic'; model: string; blocks: unknown[] };
    }
  | { role: 'tool'; toolCallId: string; name: string; content: string; isError?: boolean };

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
};

export type LLMResponse = {
  text: string;
  toolCalls: ToolCall[];
  providerRaw?: { provider: 'anthropic'; model: string; blocks: unknown[] };
  stopReason: 'end' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';
  usage?: { input: number; output: number };
};

export type LLMRequest = {
  provider: ProviderConfig;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  signal?: AbortSignal;
};

export class LLMError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
