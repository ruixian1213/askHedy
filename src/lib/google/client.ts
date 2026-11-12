import { getAccessToken } from './auth';

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      // Google API 要求重複參數（例如 metadataHeaders=From&metadataHeaders=Subject），
      // 不是逗號接成一個字串。
      for (const item of v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(item)}`);
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

export async function googleFetch<T>(
  url: string,
  init: RequestInit & { query?: Query } = {},
): Promise<T> {
  const token = await getAccessToken();
  const { query, ...rest } = init;
  const qs = buildQuery(query);
  const full = qs ? url + (url.includes('?') ? '&' : '?') + qs : url;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((rest.headers as Record<string, string>) ?? {}),
  };
  if (rest.body && typeof rest.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(full, { ...rest, headers });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      // ignore
    }
    throw new GoogleApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}
