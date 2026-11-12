export function parseSender(from: string): { name: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2] };
  return { name: from.split('@')[0] || from, email: from };
}

export function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24 && d.getDate() === now.getDate()) return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDayHeader(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  const base = `${m}/${d}（${weekday}）`;
  if (key === today) return `今天 · ${base}`;
  if (key === tomorrow) return `明天 · ${base}`;
  return base;
}

/** 以本地時區組出帶偏移的 ISO 字串，例如 2026-11-12T14:00:00+08:00 */
export function localISO(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0);
  const off = -dt.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  return `${date}T${pad(hh)}:${pad(mm)}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
