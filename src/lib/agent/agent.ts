import { chat } from '../llm';
import { ChatMessage, ProviderConfig, ToolCall } from '../llm/types';
import { toolByName, toolDefinitions } from './tools';

export type AgentEvents = {
  /** 模型回了一段文字（可能同時帶工具呼叫） */
  onAssistant: (msg: Extract<ChatMessage, { role: 'assistant' }>) => void;
  onToolStart: (call: ToolCall) => void;
  onToolResult: (msg: Extract<ChatMessage, { role: 'tool' }>) => void;
  /** 需要使用者同意時呼叫；回傳 true 才執行 */
  requestApproval: (call: ToolCall, label: string) => Promise<boolean>;
};

export type AgentRunOptions = {
  provider: ProviderConfig;
  systemPrompt: string;
  history: ChatMessage[]; // 不含 system
  signal?: AbortSignal;
  maxSteps?: number;
} & AgentEvents;

function truncate(s: string, n = 24000) {
  return s.length > n ? s.slice(0, n) + `\n…（已截斷，原長度 ${s.length}）` : s;
}

/**
 * 標準工具迴圈：模型 → (工具呼叫 → 執行 → 回填) × N → 最終回答。
 * 會把新增的訊息透過事件回報，由 store 負責持久化。
 */
export async function runAgent(opts: AgentRunOptions): Promise<void> {
  const maxSteps = opts.maxSteps ?? 12;
  const messages: ChatMessage[] = [{ role: 'system', content: opts.systemPrompt }, ...opts.history];

  for (let step = 0; step < maxSteps; step++) {
    if (opts.signal?.aborted) return;
    const res = await chat({
      provider: opts.provider,
      messages,
      tools: toolDefinitions,
      signal: opts.signal,
    });

    const assistant: Extract<ChatMessage, { role: 'assistant' }> = {
      role: 'assistant',
      content: res.text,
      toolCalls: res.toolCalls.length ? res.toolCalls : undefined,
      providerRaw: res.providerRaw,
    };
    messages.push(assistant);
    opts.onAssistant(assistant);

    if (res.stopReason === 'refusal') {
      const note: ChatMessage = { role: 'assistant', content: '（模型拒絕了這個請求，換個說法試試？）' };
      opts.onAssistant(note);
      return;
    }
    if (!res.toolCalls.length) return;

    // 並行執行所有工具呼叫，但審核卡片一次一張
    const results: Extract<ChatMessage, { role: 'tool' }>[] = [];
    for (const call of res.toolCalls) {
      if (opts.signal?.aborted) return;
      const spec = toolByName(call.name);
      let content: string;
      let isError = false;
      if (!spec) {
        content = `未知的工具：${call.name}`;
        isError = true;
      } else {
        let approved = true;
        if (spec.needsApproval) approved = await opts.requestApproval(call, spec.label);
        if (!approved) {
          content = '使用者拒絕了這個動作。請不要重試，改問使用者想怎麼調整。';
          isError = true;
        } else {
          opts.onToolStart(call);
          try {
            const out = await spec.run(call.arguments);
            content = truncate(typeof out === 'string' ? out : JSON.stringify(out ?? { ok: true }));
          } catch (e) {
            content = `工具執行失敗：${e instanceof Error ? e.message : String(e)}`;
            isError = true;
          }
        }
      }
      const toolMsg: Extract<ChatMessage, { role: 'tool' }> = {
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content,
        isError,
      };
      results.push(toolMsg);
      opts.onToolResult(toolMsg);
    }
    messages.push(...results);
  }
  opts.onAssistant({ role: 'assistant', content: '（這一輪的步驟太多了，我先停在這裡。要我繼續嗎？）' });
}
