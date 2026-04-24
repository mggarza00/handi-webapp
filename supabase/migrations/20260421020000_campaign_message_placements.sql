create table if not exists public.campaign_message_placements (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  campaign_message_id uuid not null references public.campaign_messages(id) on delete cascade,
  channel text not null,
  placement_id text not null,
  headline text,
  body text,
  cta text,
  rationale text not null default '',
  provider_metadata jsonb not null default '{}'::jsonb,
  qa_report jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'proposed', 'changes_requested', 'approved', 'rejected', 'archived')),
  source text not null default 'inherited' check (source in ('inherited', 'ai_generated', 'manual_override')),
  created_by uuid,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (campaign_message_id, placement_id)
);

create index if not exists campaign_message_placements_campaign_idx
  on public.campaign_message_placements (campaign_draft_id, placement_id);

create index if not exists campaign_message_placements_channel_idx
  on public.campaign_message_placements (channel, placement_id, status);

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_updated_at_campaign_message_placements on public.campaign_message_placements;
create trigger set_updated_at_campaign_message_placements
before update on public.campaign_message_placements
for each row execute function public.tg_set_updated_at();
