import { googleFetch } from './client';
import { decodeBase64Url, encodeBase64Url, encodeMimeWord, bytesToBase64, utf8Encode } from '../encoding';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};
export type GmailMessageRaw = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type EmailSummary = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
  labels: string[];
};

export type EmailDetail = EmailSummary & {
  cc: string;
  messageId: string;
  references: string;
  bodyText: string;
  attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[];
};

function header(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractBody(payload?: GmailPart): { text: string; attachments: EmailDetail['attachments'] } {
  let text = '';
  let html = '';
  const attachments: EmailDetail['attachments'] = [];
  const walk = (p?: GmailPart) => {
    if (!p) return;
    if (p.filename && p.body?.attachmentId) {
      attachments.push({
        filename: p.filename,
        mimeType: p.mimeType ?? 'application/octet-stream',
        size: p.body.size ?? 0,
        attachmentId: p.body.attachmentId,
      });
    } else if (p.mimeType === 'text/plain' && p.body?.data) {
      text += decodeBase64Url(p.body.data);
    } else if (p.mimeType === 'text/html' && p.body?.data) {
      html += decodeBase64Url(p.body.data);
    }
    p.parts?.forEach(walk);
  };
  walk(payload);
  return { text: text.trim() || stripHtml(html), attachments };
}

function toSummary(m: GmailMessageRaw): EmailSummary {
  const h = m.payload?.headers;
  return {
    id: m.id,
    threadId: m.threadId,
    from: header(h, 'From'),
    to: header(h, 'To'),
    subject: header(h, 'Subject') || '(無主旨)',
    date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : header(h, 'Date'),
    snippet: m.snippet ?? '',
    unread: m.labelIds?.includes('UNREAD') ?? false,
    labels: m.labelIds ?? [],
  };
}

export async function listEmails(opts: { query?: string; maxResults?: number; labelIds?: string[] } = {}) {
  const list = await googleFetch<{ messages?: { id: string }[]; resultSizeEstimate?: number }>(
    `${BASE}/messages`,
    {
      query: {
        q: opts.query,
        maxResults: opts.maxResults ?? 20,
        labelIds: opts.labelIds,
      },
    },
  );
  const ids = list.messages ?? [];
  const details = await Promise.all(
    ids.map((m) =>
      googleFetch<GmailMessageRaw>(`${BASE}/messages/${m.id}`, {
        query: { format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] },
      }),
    ),
  );
  return details.map(toSummary);
}

export async function getEmail(id: string): Promise<EmailDetail> {
  const m = await googleFetch<GmailMessageRaw>(`${BASE}/messages/${id}`, { query: { format: 'full' } });
  const h = m.payload?.headers;
  const { text, attachments } = extractBody(m.payload);
  return {
    ...toSummary(m),
    cc: header(h, 'Cc'),
    messageId: header(h, 'Message-ID'),
    references: header(h, 'References'),
    bodyText: text,
    attachments,
  };
}

function buildMime(opts: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : '',
    opts.bcc ? `Bcc: ${opts.bcc}` : '',
    `Subject: ${encodeMimeWord(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : '',
    opts.references ? `References: ${opts.references}` : '',
    '',
    bytesToBase64(utf8Encode(opts.body)).replace(/(.{76})/g, '$1\r\n'),
  ].filter((l, i) => l !== '' || i >= 9);
  return lines.join('\r\n');
}

export async function sendEmail(opts: { to: string; subject: string; body: string; cc?: string; bcc?: string }) {
  const raw = encodeBase64Url(buildMime(opts));
  return googleFetch<{ id: string; threadId: string }>(`${BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
}

export async function replyToEmail(opts: { messageId: string; body: string; replyAll?: boolean }) {
  const original = await getEmail(opts.messageId);
  const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`;
  const to = original.from;
  const cc = opts.replyAll ? [original.to, original.cc].filter(Boolean).join(', ') : undefined;
  const references = [original.references, original.messageId].filter(Boolean).join(' ');
  const raw = encodeBase64Url(
    buildMime({ to, cc, subject, body: opts.body, inReplyTo: original.messageId, references }),
  );
  return googleFetch<{ id: string; threadId: string }>(`${BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify({ raw, threadId: original.threadId }),
  });
}

export async function createDraft(opts: { to: string; subject: string; body: string; cc?: string }) {
  const raw = encodeBase64Url(buildMime(opts));
  return googleFetch<{ id: string; message: { id: string } }>(`${BASE}/drafts`, {
    method: 'POST',
    body: JSON.stringify({ message: { raw } }),
  });
}

export async function modifyEmail(id: string, add: string[] = [], remove: string[] = []) {
  return googleFetch<GmailMessageRaw>(`${BASE}/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  });
}

export const markRead = (id: string) => modifyEmail(id, [], ['UNREAD']);
export const markUnread = (id: string) => modifyEmail(id, ['UNREAD'], []);
export const archiveEmail = (id: string) => modifyEmail(id, [], ['INBOX']);
export const starEmail = (id: string) => modifyEmail(id, ['STARRED'], []);
export const trashEmail = (id: string) =>
  googleFetch<GmailMessageRaw>(`${BASE}/messages/${id}/trash`, { method: 'POST' });

export async function listLabels() {
  const r = await googleFetch<{ labels: { id: string; name: string; type: string }[] }>(`${BASE}/labels`);
  return r.labels;
}
