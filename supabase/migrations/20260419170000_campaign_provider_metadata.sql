alter table public.campaign_drafts
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.campaign_messages
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.campaign_message_versions
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

create index if not exists ix_campaign_drafts_provider_metadata
  on public.campaign_drafts using gin (provider_metadata);

create index if not exists ix_campaign_messages_provider_metadata
  on public.campaign_messages using gin (provider_metadata);
