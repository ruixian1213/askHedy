import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, ToolCall } from '../lib/llm/types';
import { runAgent } from '../lib/agent/agent';
import { buildSystemPrompt } from '../lib/agent/prompt';
import { loadMemory } from '../lib/agent/memory';
import { useSettings } from './settings';
import { useGoogle } from './google';

const KEY = 'hedy.conversations';
const MAX_CONVERSATIONS = 50;

/** 畫面用的訊息：LLM 訊息 + 僅供顯示的備註 */
export type UIMessage =
  | (ChatMessage & { id: string; ts: number })
  | { id: string; ts: number; role: 'note'; kind: 'error' | 'info' | 'denied' | 'approved'; content: string };

export type Conversation = {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
};

export type PendingApproval = {
  call: ToolCall;
  label: string;
  resolve: (ok: boolean) => void;
};

type ChatState = {
  loaded: boolean;
  conversations: Conversation[];
  currentId: string | null;
  running: boolean;
  runningTool: string | null;
  pending: PendingApproval | null;
  abort: AbortController | null;

  load: () => Promise<void>;
  current: () => Conversation | null;
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  send: (text: string) => Promise<void>;
  /** 從其他分頁丟一個任務給 Hedy（會開新對話） */
  startTask: (text: string) => Promise<void>;
  resolveApproval: (ok: boolean) => void;
  stop: () => void;
};

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function persist(conversations: Conversation[]) {
  return AsyncStorage.setItem(KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
}

/** 只把真正要給模型的訊息抽出來 */
export function toHistory(messages: UIMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === 'note') continue;
    const { id: _id, ts: _ts, ...rest } = m;
    out.push(rest as ChatMessage);
  }
  // 若最後一則 assistant 帶 toolCalls 卻沒有對應 tool 結果（例如中途停止），補上取消結果
  const last = out[out.length - 1];
  if (last?.role === 'assistant' && last.toolCalls?.length) {
    last.toolCalls.forEach((c) =>
      out.push({ role: 'tool', toolCallId: c.id, name: c.name, content: '（已中止）', isError: true }),
    );
  }
  return out;
}

export const useChat = create<ChatState>((set, get) => ({
  loaded: false,
  conversations: [],
  currentId: null,
  running: false,
  runningTool: null,
  pending: null,
  abort: null,

  load: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    const conversations = raw ? (JSON.parse(raw) as Conversation[]) : [];
    set({ conversations, currentId: conversations[0]?.id ?? null, loaded: true });
  },

  current: () => {
    const { conversations, currentId } = get();
    return conversations.find((c) => c.id === currentId) ?? null;
  },

  newConversation: () => {
    const existingEmpty = get().conversations.find((c) => c.messages.length === 0);
    if (existingEmpty) {
      set({ currentId: existingEmpty.id });
      return existingEmpty.id;
    }
    const c: Conversation = { id: uid(), title: '新對話', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    const conversations = [c, ...get().conversations];
    set({ conversations, currentId: c.id });
    void persist(conversations);
    return c.id;
  },

  selectConversation: (id) => set({ currentId: id }),

  deleteConversation: async (id) => {
    const conversations = get().conversations.filter((c) => c.id !== id);
    set({ conversations, currentId: get().currentId === id ? conversations[0]?.id ?? null : get().currentId });
    await persist(conversations);
  },

  clearAll: async () => {
    set({ conversations: [], currentId: null });
    await AsyncStorage.removeItem(KEY);
  },

  startTask: async (text) => {
    get().newConversation();
    await get().send(text);
  },

  resolveApproval: (ok) => {
    const p = get().pending;
    if (!p) return;
    set({ pending: null });
    p.resolve(ok);
  },

  stop: () => {
    get().abort?.abort();
    get().pending?.resolve(false);
    set({ running: false, runningTool: null, pending: null, abort: null });
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().running) return;
    const settings = useSettings.getState();
    const provider = settings.activeProvider();
    let convId = get().currentId ?? get().newConversation();

    const append = (msg: UIMessage | ((prev: UIMessage[]) => UIMessage[])) => {
      set((s) => {
        const conversations = s.conversations.map((c) => {
          if (c.id !== convId) return c;
          const messages = typeof msg === 'function' ? msg(c.messages) : [...c.messages, msg];
          const title =
            c.title === '新對話' && messages.length
              ? (messages.find((m) => m.role === 'user')?.content ?? '新對話').slice(0, 30)
              : c.title;
          return { ...c, messages, title, updatedAt: Date.now() };
        });
        void persist(conversations);
        return { conversations };
      });
    };

    append({ id: uid(), ts: Date.now(), role: 'user', content: trimmed });

    if (!provider || !provider.apiKey) {
      append({
        id: uid(),
        ts: Date.now(),
        role: 'note',
        kind: 'error',
        content: '還沒有設定 AI 模型。請到「設定」→「AI 模型」新增一個供應商（OpenRouter、OpenAI、Claude…）。',
      });
      return;
    }

    const abort = new AbortController();
    set({ running: true, abort, runningTool: null });

    const google = useGoogle.getState();
    const memory = await loadMemory().catch(() => []);
    const systemPrompt = buildSystemPrompt({
      userName: settings.prefs.userName || undefined,
      userEmail: google.profile?.email,
      googleConnected: google.connected,
      memory,
    });
    const conv = get().conversations.find((c) => c.id === convId);
    const history = toHistory(conv?.messages ?? []);

    try {
      await runAgent({
        provider,
        systemPrompt,
        history,
        signal: abort.signal,
        onAssistant: (m) => {
          if (m.content || m.toolCalls?.length) append({ ...m, id: uid(), ts: Date.now() });
        },
        onToolStart: (call) => set({ runningTool: call.name }),
        onToolResult: (m) => {
          set({ runningTool: null });
          append({ ...m, id: uid(), ts: Date.now() });
        },
        requestApproval: (call, label) => {
          if (useSettings.getState().prefs.autoApprove) return Promise.resolve(true);
          return new Promise<boolean>((resolve) => {
            set({
              pending: {
                call,
                label,
                resolve: (ok) => {
                  append({
                    id: uid(),
                    ts: Date.now(),
                    role: 'note',
                    kind: ok ? 'approved' : 'denied',
                    content: ok ? `已允許：${label}` : `已拒絕：${label}`,
                  });
                  resolve(ok);
                },
              },
            });
          });
        },
      });
    } catch (e) {
      if (!abort.signal.aborted) {
        append({
          id: uid(),
          ts: Date.now(),
          role: 'note',
          kind: 'error',
          content: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      set({ running: false, runningTool: null, pending: null, abort: null });
    }
  },
}));
