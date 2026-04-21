create table if not exists public.campaign_internal_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  note text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.campaign_drafts
  add column if not exists owner_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists owner_assigned_at timestamptz null,
  add column if not exists source_campaign_draft_id uuid null references public.campaign_drafts(id) on delete set null,
  add column if not exists campaign_review_checklist jsonb not null default jsonb_build_object(
    'brandAligned', false,
    'messageClear', false,
    'ctaCorrect', false,
    'audienceCorrect', false,
    'channelCorrect', false,
    'claimsSafe', false,
    'readyForApproval', false
  ),
  add column if not exists generation_provider text not null default 'mock',
  add column if not exists generation_provider_status text null;

create index if not exists ix_campaign_drafts_owner_updated_at
  on public.campaign_drafts (owner_user_id, updated_at desc);
create index if not exists ix_campaign_drafts_source_campaign
  on public.campaign_drafts (source_campaign_draft_id);
create index if not exists ix_campaign_internal_notes_campaign_created
  on public.campaign_internal_notes (campaign_draft_id, created_at desc);

alter table public.campaign_internal_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'campaign_internal_notes'
      and policyname = 'campaign_internal_notes_read'
  ) then
    create policy campaign_internal_notes_read
      on public.campaign_internal_notes
      for select
      using (public.has_admin_access());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'campaign_internal_notes'
      and policyname = 'campaign_internal_notes_insert'
  ) then
    create policy campaign_internal_notes_insert
      on public.campaign_internal_notes
      for insert
      with check (public.has_admin_access());
  end if;
end $$;
