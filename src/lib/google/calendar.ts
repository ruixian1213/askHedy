import { googleFetch } from './client';

const BASE = 'https://www.googleapis.com/calendar/v3';

export type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
};

export type CalendarListEntry = { id: string; summary: string; primary?: boolean; backgroundColor?: string };

export async function listCalendars() {
  const r = await googleFetch<{ items: CalendarListEntry[] }>(`${BASE}/users/me/calendarList`);
  return r.items ?? [];
}

export async function listEvents(opts: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  query?: string;
}) {
  const r = await googleFetch<{ items: CalendarEvent[] }>(
    `${BASE}/calendars/${encodeURIComponent(opts.calendarId ?? 'primary')}/events`,
    {
      query: {
        timeMin: opts.timeMin ?? new Date().toISOString(),
        timeMax: opts.timeMax,
        maxResults: opts.maxResults ?? 30,
        singleEvents: true,
        orderBy: 'startTime',
        q: opts.query,
      },
    },
  );
  return r.items ?? [];
}

export type NewEvent = {
  summary: string;
  description?: string;
  location?: string;
  /** ISO 8601；若為整日事件請用 YYYY-MM-DD 並設定 allDay */
  start: string;
  end: string;
  allDay?: boolean;
  attendees?: string[];
  timeZone?: string;
  reminderMinutes?: number;
};

function toBody(e: NewEvent) {
  const tz = e.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    summary: e.summary,
    description: e.description,
    location: e.location,
    start: e.allDay ? { date: e.start.slice(0, 10) } : { dateTime: e.start, timeZone: tz },
    end: e.allDay ? { date: e.end.slice(0, 10) } : { dateTime: e.end, timeZone: tz },
    attendees: e.attendees?.map((email) => ({ email })),
    reminders:
      e.reminderMinutes !== undefined
        ? { useDefault: false, overrides: [{ method: 'popup', minutes: e.reminderMinutes }] }
        : undefined,
  };
}

export async function createEvent(e: NewEvent, calendarId = 'primary') {
  return googleFetch<CalendarEvent>(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(toBody(e)),
    query: { sendUpdates: e.attendees?.length ? 'all' : 'none' },
  });
}

export async function updateEvent(eventId: string, patch: Partial<NewEvent>, calendarId = 'primary') {
  const body: Record<string, unknown> = {};
  const tz = patch.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.start) body.start = patch.allDay ? { date: patch.start.slice(0, 10) } : { dateTime: patch.start, timeZone: tz };
  if (patch.end) body.end = patch.allDay ? { date: patch.end.slice(0, 10) } : { dateTime: patch.end, timeZone: tz };
  if (patch.attendees) body.attendees = patch.attendees.map((email) => ({ email }));
  return googleFetch<CalendarEvent>(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function deleteEvent(eventId: string, calendarId = 'primary') {
  await googleFetch<void>(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
}

export function formatEventTime(e: CalendarEvent): string {
  if (e.start.date) return `整天 · ${e.start.date}`;
  const s = new Date(e.start.dateTime!);
  const en = new Date(e.end.dateTime!);
  const fmt = (d: Date) => d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(s)} – ${fmt(en)}`;
}
