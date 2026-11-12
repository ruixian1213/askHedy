import { googleFetch } from './client';

const BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  owners?: { displayName?: string; emailAddress?: string }[];
};

const FIELDS = 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents,owners),nextPageToken';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export async function listFiles(opts: { folderId?: string; query?: string; pageSize?: number } = {}) {
  const parts: string[] = ['trashed = false'];
  if (opts.folderId) parts.push(`'${opts.folderId}' in parents`);
  if (opts.query) parts.push(`(name contains '${opts.query.replace(/'/g, "\\'")}' or fullText contains '${opts.query.replace(/'/g, "\\'")}')`);
  const r = await googleFetch<{ files: DriveFile[] }>(`${BASE}/files`, {
    query: {
      q: parts.join(' and '),
      pageSize: opts.pageSize ?? 30,
      fields: FIELDS,
      orderBy: opts.query ? undefined : 'folder,modifiedTime desc',
      spaces: 'drive',
    },
  });
  return r.files ?? [];
}

export async function getFileMeta(fileId: string) {
  return googleFetch<DriveFile>(`${BASE}/files/${fileId}`, {
    query: { fields: 'id,name,mimeType,size,modifiedTime,webViewLink,parents' },
  });
}

const EXPORTABLE: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

/** 讀取檔案文字內容；Google 文件/試算表/簡報會自動匯出為純文字 */
export async function readFileText(fileId: string, maxChars = 20000): Promise<string> {
  const meta = await getFileMeta(fileId);
  let text: string;
  if (EXPORTABLE[meta.mimeType]) {
    text = await googleFetch<string>(`${BASE}/files/${fileId}/export`, {
      query: { mimeType: EXPORTABLE[meta.mimeType] },
    });
  } else if (meta.mimeType.startsWith('text/') || meta.mimeType === 'application/json') {
    text = await googleFetch<string>(`${BASE}/files/${fileId}`, { query: { alt: 'media' } });
  } else {
    return `（${meta.name} 是 ${meta.mimeType}，無法以文字方式讀取；連結：${meta.webViewLink ?? '無'}）`;
  }
  if (typeof text !== 'string') text = JSON.stringify(text);
  return text.length > maxChars ? text.slice(0, maxChars) + `\n…（已截斷，共 ${text.length} 字）` : text;
}

export async function createTextFile(opts: { name: string; content: string; folderId?: string; mimeType?: string }) {
  const boundary = 'hedy_boundary_' + Date.now();
  const meta = { name: opts.name, parents: opts.folderId ? [opts.folderId] : undefined, mimeType: opts.mimeType };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: ${opts.mimeType ?? 'text/plain'}; charset=UTF-8\r\n\r\n${opts.content}\r\n` +
    `--${boundary}--`;
  return googleFetch<DriveFile>(`${UPLOAD}/files`, {
    method: 'POST',
    query: { uploadType: 'multipart', fields: 'id,name,webViewLink' },
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

export async function createFolder(name: string, parentId?: string) {
  return googleFetch<DriveFile>(`${BASE}/files`, {
    method: 'POST',
    query: { fields: 'id,name,webViewLink' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  });
}

export async function moveFile(fileId: string, newParentId: string) {
  const meta = await getFileMeta(fileId);
  return googleFetch<DriveFile>(`${BASE}/files/${fileId}`, {
    method: 'PATCH',
    query: { addParents: newParentId, removeParents: (meta.parents ?? []).join(','), fields: 'id,name,parents' },
    body: JSON.stringify({}),
  });
}

export async function renameFile(fileId: string, name: string) {
  return googleFetch<DriveFile>(`${BASE}/files/${fileId}`, {
    method: 'PATCH',
    query: { fields: 'id,name' },
    body: JSON.stringify({ name }),
  });
}

export async function trashFile(fileId: string) {
  return googleFetch<DriveFile>(`${BASE}/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ trashed: true }),
  });
}

export function formatSize(size?: string): string {
  if (!size) return '';
  const n = Number(size);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fileKind(mime: string): string {
  if (mime === FOLDER_MIME) return 'folder';
  if (mime.includes('document')) return 'doc';
  if (mime.includes('spreadsheet')) return 'sheet';
  if (mime.includes('presentation')) return 'slides';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}
