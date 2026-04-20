create table if not exists public.campaign_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  provider_event_id text null,
  dedupe_key text not null,
  event_source text not null,
  provider_event_type text not null,
  normalized_event_type text null,
  campaign_draft_id uuid null references public.campaign_drafts(id) on delete cascade,
  campaign_message_id uuid null references public.campaign_messages(id) on delete set null,
  publish_job_id uuid null references public.campaign_publish_jobs(id) on delete set null,
  channel text null,
  target_user_id text null,
  target_identifier text null,
  event_timestamp timestamptz not null default timezone('utc', now()),
  processed_status text not null default 'processed',
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  normalized_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ux_campaign_provider_events_dedupe
  on public.campaign_provider_events (dedupe_key);

create unique index if not exists ux_campaign_provider_events_provider_event
  on public.campaign_provider_events (provider_name, provider_event_id)
  where provider_event_id is not null;

create index if not exists ix_campaign_provider_events_draft
  on public.campaign_provider_events (campaign_draft_id, event_timestamp desc);

create index if not exists ix_campaign_provider_events_message
  on public.campaign_provider_events (campaign_message_id, event_timestamp desc);

create index if not exists ix_campaign_provider_events_job
  on public.campaign_provider_events (publish_job_id, event_timestamp desc);

create index if not exists ix_campaign_provider_events_status
  on public.campaign_provider_events (processed_status, event_timestamp desc);

create index if not exists ix_campaign_provider_events_channel
  on public.campaign_provider_events (channel, event_timestamp desc);
