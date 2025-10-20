export type ScheduledService = {
  id: string; // request id
  title: string;
  scheduled_at: string; // ISO-like (local) start
  scheduled_end_at?: string | null;
  client_name?: string | null;
  city?: string | null;
  status?: string | null; // 'scheduled' | 'in_process' | ...
};

export type CalendarEvent = ScheduledService & { dateKey: string };
