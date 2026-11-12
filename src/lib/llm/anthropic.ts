import { ChatMessage, LLMError, LLMRequest, LLMResponse, ToolCall } from './types';

/**
 * Anthropic Messages API（直接用 fetch；行動端不帶 Node SDK）。
 * 文件：https://platform.claude.com/docs/en/api/messages
 */

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown[] };

function toAnthropic(messages: ChatMessage[], model: string): { system: string; messages: AnthropicMessage[] } {
  const system = messages
    .filter((m): m is Extract<ChatMessage, { role: 'system' }> => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const out: AnthropicMessage[] = [];
  const push = (role: 'user' | 'assistant', blocks: AnthropicBlock[]) => {
    const last = out[out.length - 1];
    // 連續的同角色訊息要合併（多個 tool_result 必須放在同一則 user 訊息）
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === 'user') push('user', [{ type: 'text', text: m.content }]);
    else if (m.role === 'assistant') {
      // 同一個模型產生的回覆：原樣帶回（保留 thinking blocks 與 signature）
      if (m.providerRaw?.provider === 'anthropic' && m.providerRaw.model === model && m.providerRaw.blocks.length) {
        push('assistant', m.providerRaw.blocks as AnthropicBlock[]);
        continue;
      }
      const blocks: AnthropicBlock[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      m.toolCalls?.forEach((t) => blocks.push({ type: 'tool_use', id: t.id, name: t.name, input: t.arguments }));
      if (blocks.length) push('assistant', blocks);
    } else if (m.role === 'tool') {
      push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content, is_error: m.isError }]);
    }
  }
  return { system, messages: out };
}

export async function chatAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const { provider } = req;
  const { system, messages } = toAnthropic(req.messages, provider.model);
  const body: Record<string, unknown> = {
    model: provider.model,
    max_tokens: req.maxTokens ?? 8192,
    system: system || undefined,
    messages,
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }
  const res = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/v1/messages`, {
    method: 'POST',
    signal: req.signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
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
    throw new LLMError(`Claude 請求失敗 (${res.status})：${detail}`, res.status);
  }
  const j = await res.json();
  const blocks = (j.content ?? []) as AnthropicBlock[];
  const text = blocks
    .filter((b): b is Extract<AnthropicBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const toolCalls: ToolCall[] = blocks
    .filter((b): b is Extract<AnthropicBlock, { type: 'tool_use' }> => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, arguments: b.input ?? {} }));
  const stop = j.stop_reason as string | undefined;
  return {
    text,
    toolCalls,
    providerRaw: { provider: 'anthropic', model: provider.model, blocks },
    stopReason:
      stop === 'tool_use'
        ? 'tool_use'
        : stop === 'max_tokens'
          ? 'max_tokens'
          : stop === 'refusal'
            ? 'refusal'
            : 'end',
    usage: j.usage ? { input: j.usage.input_tokens ?? 0, output: j.usage.output_tokens ?? 0 } : undefined,
  };
}

export async function listAnthropicModels(baseUrl: string, apiKey: string) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/models?limit=100`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (!res.ok) throw new LLMError(`無法取得模型列表 (${res.status})`, res.status);
  const j = await res.json();
  return ((j.data ?? []) as { id: string }[]).map((m) => m.id);
}
