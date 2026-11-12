import { ToolDefinition } from '../llm/types';
import * as gmail from '../google/gmail';
import * as calendar from '../google/calendar';
import * as drive from '../google/drive';
import { saveMemory } from './memory';

type Args = Record<string, unknown>;
const str = (a: Args, k: string, def = ''): string => (typeof a[k] === 'string' ? (a[k] as string) : def);
const num = (a: Args, k: string, def: number): number => (typeof a[k] === 'number' ? (a[k] as number) : def);
const bool = (a: Args, k: string, def = false): boolean => (typeof a[k] === 'boolean' ? (a[k] as boolean) : def);
const arr = (a: Args, k: string): string[] => (Array.isArray(a[k]) ? (a[k] as unknown[]).map(String) : []);

export type ToolSpec = ToolDefinition & {
  /** 會改變外部狀態（寄信、建立行程、刪除檔案）→ 執行前要使用者同意 */
  needsApproval?: boolean;
  /** 給審核卡片看的中文標題 */
  label: string;
  run: (args: Args) => Promise<unknown>;
};

export const TOOLS: ToolSpec[] = [
  // ───────── Gmail ─────────
  {
    name: 'gmail_search',
    label: '搜尋信件',
    description:
      '搜尋使用者的 Gmail。query 使用 Gmail 搜尋語法，例如 "is:unread", "from:boss@x.com newer_than:7d", "subject:發票"。留空則回傳收件匣最新信件。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail 搜尋語法' },
        max_results: { type: 'number', description: '最多幾封（預設 10，最多 30）' },
      },
    },
    run: async (a) => {
      const list = await gmail.listEmails({
        query: str(a, 'query') || 'in:inbox',
        maxResults: Math.min(num(a, 'max_results', 10), 30),
      });
      return list.map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        date: m.date,
        unread: m.unread,
        snippet: m.snippet,
      }));
    },
  },
  {
    name: 'gmail_read',
    label: '讀取信件全文',
    description: '讀取一封信的完整內容（含寄件人、收件人、內文、附件清單）。',
    parameters: {
      type: 'object',
      properties: { message_id: { type: 'string' } },
      required: ['message_id'],
    },
    run: async (a) => {
      const m = await gmail.getEmail(str(a, 'message_id'));
      return {
        id: m.id,
        from: m.from,
        to: m.to,
        cc: m.cc,
        subject: m.subject,
        date: m.date,
        body: m.bodyText.slice(0, 12000),
        attachments: m.attachments.map((x) => `${x.filename} (${x.mimeType})`),
      };
    },
  },
  {
    name: 'gmail_send',
    label: '寄出新郵件',
    needsApproval: true,
    description: '寄出一封新郵件。寄出前使用者會看到內容並確認。body 請用純文字。',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '收件人，多人用逗號分隔' },
        subject: { type: 'string' },
        body: { type: 'string' },
        cc: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
    run: (a) => gmail.sendEmail({ to: str(a, 'to'), subject: str(a, 'subject'), body: str(a, 'body'), cc: str(a, 'cc') || undefined }),
  },
  {
    name: 'gmail_reply',
    label: '回覆郵件',
    needsApproval: true,
    description: '回覆一封既有的信（會自動帶上主旨與對話串）。',
    parameters: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        body: { type: 'string' },
        reply_all: { type: 'boolean' },
      },
      required: ['message_id', 'body'],
    },
    run: (a) => gmail.replyToEmail({ messageId: str(a, 'message_id'), body: str(a, 'body'), replyAll: bool(a, 'reply_all') }),
  },
  {
    name: 'gmail_draft',
    label: '建立草稿',
    description: '把信存成草稿（不寄出），讓使用者之後在 Gmail 裡修改。',
    parameters: {
      type: 'object',
      properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, cc: { type: 'string' } },
      required: ['to', 'subject', 'body'],
    },
    run: (a) => gmail.createDraft({ to: str(a, 'to'), subject: str(a, 'subject'), body: str(a, 'body'), cc: str(a, 'cc') || undefined }),
  },
  {
    name: 'gmail_modify',
    label: '變更信件狀態',
    needsApproval: true,
    description: '對信件做標記：read（已讀）、unread（未讀）、archive（封存）、star（加星號）、trash（移到垃圾桶）。',
    parameters: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        action: { type: 'string', enum: ['read', 'unread', 'archive', 'star', 'trash'] },
      },
      required: ['message_id', 'action'],
    },
    run: async (a) => {
      const id = str(a, 'message_id');
      const action = str(a, 'action');
      const fn = { read: gmail.markRead, unread: gmail.markUnread, archive: gmail.archiveEmail, star: gmail.starEmail, trash: gmail.trashEmail }[action];
      if (!fn) throw new Error(`未知的 action: ${action}`);
      await fn(id);
      return { ok: true, action };
    },
  },
  // ───────── Calendar ─────────
  {
    name: 'calendar_list_events',
    label: '查詢行程',
    description: '列出 Google 日曆的行程。time_min / time_max 為 ISO 8601；不填 time_min 則從現在開始。',
    parameters: {
      type: 'object',
      properties: {
        time_min: { type: 'string' },
        time_max: { type: 'string' },
        query: { type: 'string', description: '關鍵字' },
        max_results: { type: 'number' },
      },
    },
    run: async (a) => {
      const items = await calendar.listEvents({
        timeMin: str(a, 'time_min') || undefined,
        timeMax: str(a, 'time_max') || undefined,
        query: str(a, 'query') || undefined,
        maxResults: Math.min(num(a, 'max_results', 20), 50),
      });
      return items.map((e) => ({
        id: e.id,
        title: e.summary ?? '(無標題)',
        start: e.start.dateTime ?? e.start.date,
        end: e.end.dateTime ?? e.end.date,
        location: e.location,
        description: e.description?.slice(0, 300),
        attendees: e.attendees?.map((x) => x.email),
      }));
    },
  },
  {
    name: 'calendar_create_event',
    label: '建立行程',
    needsApproval: true,
    description:
      '在主要日曆建立行程。start/end 用 ISO 8601（含時區偏移，例如 2026-11-12T14:00:00+08:00）；整日事件 all_day=true 並給 YYYY-MM-DD。',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        all_day: { type: 'boolean' },
        description: { type: 'string' },
        location: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' }, description: '與會者 email' },
        reminder_minutes: { type: 'number' },
      },
      required: ['summary', 'start', 'end'],
    },
    run: async (a) => {
      const e = await calendar.createEvent({
        summary: str(a, 'summary'),
        start: str(a, 'start'),
        end: str(a, 'end'),
        allDay: bool(a, 'all_day'),
        description: str(a, 'description') || undefined,
        location: str(a, 'location') || undefined,
        attendees: arr(a, 'attendees'),
        reminderMinutes: typeof a.reminder_minutes === 'number' ? (a.reminder_minutes as number) : undefined,
      });
      return { id: e.id, link: e.htmlLink };
    },
  },
  {
    name: 'calendar_update_event',
    label: '修改行程',
    needsApproval: true,
    description: '修改既有行程，只需提供要變更的欄位。',
    parameters: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        summary: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        all_day: { type: 'boolean' },
        description: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['event_id'],
    },
    run: async (a) => {
      const patch: Partial<calendar.NewEvent> = {};
      for (const k of ['summary', 'start', 'end', 'description', 'location'] as const) {
        if (typeof a[k] === 'string') patch[k] = a[k] as string;
      }
      if (typeof a.all_day === 'boolean') patch.allDay = a.all_day as boolean;
      const e = await calendar.updateEvent(str(a, 'event_id'), patch);
      return { id: e.id, link: e.htmlLink };
    },
  },
  {
    name: 'calendar_delete_event',
    label: '刪除行程',
    needsApproval: true,
    description: '刪除一個行程。',
    parameters: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] },
    run: async (a) => {
      await calendar.deleteEvent(str(a, 'event_id'));
      return { ok: true };
    },
  },
  // ───────── Drive ─────────
  {
    name: 'drive_search',
    label: '搜尋雲端硬碟',
    description: '在 Google Drive 搜尋檔案（名稱或全文）。可指定 folder_id 只列出某資料夾。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, folder_id: { type: 'string' }, max_results: { type: 'number' } },
    },
    run: async (a) => {
      const files = await drive.listFiles({
        query: str(a, 'query') || undefined,
        folderId: str(a, 'folder_id') || undefined,
        pageSize: Math.min(num(a, 'max_results', 20), 50),
      });
      return files.map((f) => ({ id: f.id, name: f.name, type: f.mimeType, modified: f.modifiedTime, size: f.size, link: f.webViewLink }));
    },
  },
  {
    name: 'drive_read',
    label: '讀取檔案內容',
    description: '讀取 Drive 檔案的文字內容（Google 文件/試算表/簡報會自動轉成文字）。',
    parameters: { type: 'object', properties: { file_id: { type: 'string' } }, required: ['file_id'] },
    run: async (a) => ({ content: await drive.readFileText(str(a, 'file_id')) }),
  },
  {
    name: 'drive_create_text_file',
    label: '建立文字檔',
    needsApproval: true,
    description: '在 Drive 建立純文字 / Markdown 檔。若要建立 Google 文件，mime_type 填 application/vnd.google-apps.document。',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' }, content: { type: 'string' }, folder_id: { type: 'string' }, mime_type: { type: 'string' } },
      required: ['name', 'content'],
    },
    run: async (a) => {
      const f = await drive.createTextFile({
        name: str(a, 'name'),
        content: str(a, 'content'),
        folderId: str(a, 'folder_id') || undefined,
        mimeType: str(a, 'mime_type') || undefined,
      });
      return { id: f.id, link: f.webViewLink };
    },
  },
  {
    name: 'drive_create_folder',
    label: '建立資料夾',
    needsApproval: true,
    description: '建立資料夾。',
    parameters: { type: 'object', properties: { name: { type: 'string' }, parent_id: { type: 'string' } }, required: ['name'] },
    run: async (a) => {
      const f = await drive.createFolder(str(a, 'name'), str(a, 'parent_id') || undefined);
      return { id: f.id, link: f.webViewLink };
    },
  },
  {
    name: 'drive_organize',
    label: '整理檔案',
    needsApproval: true,
    description: '對檔案做 move（移到 target_folder_id）、rename（改成 new_name）或 trash（移到垃圾桶）。',
    parameters: {
      type: 'object',
      properties: {
        file_id: { type: 'string' },
        action: { type: 'string', enum: ['move', 'rename', 'trash'] },
        target_folder_id: { type: 'string' },
        new_name: { type: 'string' },
      },
      required: ['file_id', 'action'],
    },
    run: async (a) => {
      const id = str(a, 'file_id');
      const action = str(a, 'action');
      if (action === 'move') await drive.moveFile(id, str(a, 'target_folder_id'));
      else if (action === 'rename') await drive.renameFile(id, str(a, 'new_name'));
      else if (action === 'trash') await drive.trashFile(id);
      else throw new Error(`未知的 action: ${action}`);
      return { ok: true, action };
    },
  },
  // ───────── Memory ─────────
  {
    name: 'memory_save',
    label: '記住一件事',
    description:
      '把關於使用者的長期資訊記下來（偏好、常聯絡的人、慣用語氣、重要日期）。只記真正有用且使用者同意分享的事，一句話一條。',
    parameters: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] },
    run: async (a) => {
      await saveMemory(str(a, 'note'));
      return { ok: true };
    },
  },
];

export const toolDefinitions: ToolDefinition[] = TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
export const toolByName = (name: string) => TOOLS.find((t) => t.name === name);
