alter table public.campaign_drafts
  add column if not exists publish_status text not null default 'not_ready',
  add column if not exists publish_ready_at timestamptz null,
  add column if not exists published_at timestamptz null,
  add column if not exists last_publish_error text null;

create index if not exists ix_campaign_drafts_publish_status
  on public.campaign_drafts (publish_status);

create table if not exists public.campaign_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  channel text not null,
  message_id uuid null references public.campaign_messages(id) on delete set null,
  publish_status text not null default 'publishing',
  publish_mode text not null,
  provider_name text not null,
  provider_response_summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  external_reference_id text null,
  error_message text null,
  triggered_by uuid null,
  triggered_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null
);

create index if not exists ix_campaign_publish_jobs_draft
  on public.campaign_publish_jobs (campaign_draft_id, triggered_at desc);

create index if not exists ix_campaign_publish_jobs_status
  on public.campaign_publish_jobs (publish_status);
