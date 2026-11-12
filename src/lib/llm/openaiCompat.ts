import { ChatMessage, LLMError, LLMRequest, LLMResponse, ToolCall } from './types';

type OAIMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

function toOpenAIMessages(messages: ChatMessage[]): OAIMessage[] {
  return messages.map((m): OAIMessage => {
    switch (m.role) {
      case 'system':
      case 'user':
        return { role: m.role, content: m.content };
      case 'assistant':
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls?.length
            ? m.toolCalls.map((t) => ({
                id: t.id,
                type: 'function' as const,
                function: { name: t.name, arguments: JSON.stringify(t.arguments) },
              }))
            : undefined,
        };
      case 'tool':
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
  });
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return { _raw: raw };
  }
}

/** 任何 OpenAI 相容的 /chat/completions 端點（OpenAI、OpenRouter、Groq、DeepSeek、Ollama…） */
export async function chatOpenAICompat(req: LLMRequest): Promise<LLMResponse> {
  const { provider } = req;
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: toOpenAIMessages(req.messages),
    max_tokens: req.maxTokens ?? 4096,
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = 'auto';
  }
  const res = await fetch(url, {
    method: 'POST',
    signal: req.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message ?? JSON.stringify(j).slice(0, 300);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new LLMError(`模型請求失敗 (${res.status})：${detail}`, res.status);
  }
  const j = await res.json();
  const choice = j.choices?.[0];
  if (!choice) throw new LLMError('模型沒有回傳任何內容');
  const msg = choice.message ?? {};
  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map(
    (t: { id?: string; function?: { name?: string; arguments?: string } }, i: number) => ({
      id: t.id ?? `call_${Date.now()}_${i}`,
      name: t.function?.name ?? '',
      arguments: safeParseArgs(t.function?.arguments),
    }),
  );
  const finish = choice.finish_reason as string | undefined;
  return {
    text: typeof msg.content === 'string' ? msg.content : '',
    toolCalls,
    stopReason:
      toolCalls.length > 0 || finish === 'tool_calls'
        ? 'tool_use'
        : finish === 'length'
          ? 'max_tokens'
          : finish === 'content_filter'
            ? 'refusal'
            : 'end',
    usage: j.usage ? { input: j.usage.prompt_tokens ?? 0, output: j.usage.completion_tokens ?? 0 } : undefined,
  };
}

/** 從 OpenAI 相容端點列出可用模型（給設定頁下拉選單用） */
export async function listOpenAICompatModels(baseUrl: string, apiKey: string, extraHeaders?: Record<string, string>) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, ...(extraHeaders ?? {}) },
  });
  if (!res.ok) throw new LLMError(`無法取得模型列表 (${res.status})`, res.status);
  const j = await res.json();
  const ids: string[] = (j.data ?? []).map((m: { id: string }) => m.id);
  return ids.sort();
}
