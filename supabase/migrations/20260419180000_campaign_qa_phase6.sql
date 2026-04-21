alter table public.campaign_drafts
  add column if not exists qa_report jsonb not null default '{}'::jsonb;

alter table public.campaign_messages
  add column if not exists qa_report jsonb not null default '{}'::jsonb;

create index if not exists ix_campaign_drafts_qa_report
  on public.campaign_drafts using gin (qa_report);

create index if not exists ix_campaign_messages_qa_report
  on public.campaign_messages using gin (qa_report);
