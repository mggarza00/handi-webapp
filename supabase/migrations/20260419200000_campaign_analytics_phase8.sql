create table if not exists public.campaign_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  campaign_message_id uuid null references public.campaign_messages(id) on delete set null,
  publish_job_id uuid null references public.campaign_publish_jobs(id) on delete set null,
  channel text not null,
  source text not null default 'manual',
  impressions integer not null default 0,
  clicks integer not null default 0,
  opens integer not null default 0,
  replies integer not null default 0,
  deliveries integer not null default 0,
  conversions integer not null default 0,
  failures integer not null default 0,
  spend numeric(12,2) null,
  revenue numeric(12,2) null,
  ctr numeric(8,2) null,
  open_rate numeric(8,2) null,
  click_to_open_rate numeric(8,2) null,
  conversion_rate numeric(8,2) null,
  delivery_rate numeric(8,2) null,
  failure_rate numeric(8,2) null,
  recorded_at timestamptz not null default timezone('utc', now())
);

create index if not exists ix_campaign_perf_metrics_draft
  on public.campaign_performance_metrics (campaign_draft_id, recorded_at desc);

create index if not exists ix_campaign_perf_metrics_message
  on public.campaign_performance_metrics (campaign_message_id, recorded_at desc);

create index if not exists ix_campaign_perf_metrics_job
  on public.campaign_performance_metrics (publish_job_id, recorded_at desc);

create index if not exists ix_campaign_perf_metrics_channel
  on public.campaign_performance_metrics (channel, recorded_at desc);

create table if not exists public.campaign_performance_events (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  campaign_message_id uuid null references public.campaign_messages(id) on delete set null,
  publish_job_id uuid null references public.campaign_publish_jobs(id) on delete set null,
  channel text not null,
  event_type text not null,
  event_count integer not null default 1,
  target_user_id text null,
  target_identifier text null,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists ix_campaign_perf_events_draft
  on public.campaign_performance_events (campaign_draft_id, occurred_at desc);

create index if not exists ix_campaign_perf_events_message
  on public.campaign_performance_events (campaign_message_id, occurred_at desc);

create index if not exists ix_campaign_perf_events_job
  on public.campaign_performance_events (publish_job_id, occurred_at desc);

create index if not exists ix_campaign_perf_events_channel
  on public.campaign_performance_events (channel, occurred_at desc);
