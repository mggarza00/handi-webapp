create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'campaign_workflow_status'
  ) then
    create type public.campaign_workflow_status as enum (
      'draft',
      'proposed',
      'changes_requested',
      'approved',
      'rejected',
      'archived'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'campaign_feedback_type'
  ) then
    create type public.campaign_feedback_type as enum (
      'approve',
      'reject',
      'request_changes',
      'edit',
      'regenerate'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'campaign_version_action'
  ) then
    create type public.campaign_version_action as enum (
      'initial_generation',
      'manual_edit',
      'regenerate'
    );
  end if;
end $$;

create table if not exists public.campaign_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience text not null check (audience in ('client', 'professional', 'business')),
  goal text not null check (goal in ('awareness', 'acquisition', 'activation', 'conversion', 'retention', 'reactivation', 'upsell', 'referral', 'education')),
  channels text[] not null default '{}'::text[],
  service_category text not null,
  offer text not null,
  cta text not null,
  journey_trigger text null,
  notes text null,
  rationale_summary text not null,
  recommended_angle text not null,
  brand_context jsonb not null default '{}'::jsonb,
  channel_plan jsonb not null default '[]'::jsonb,
  kpi_suggestions jsonb not null default '[]'::jsonb,
  status public.campaign_workflow_status not null default 'proposed',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_campaign_drafts_status_updated_at
  on public.campaign_drafts (status, updated_at desc);
create index if not exists ix_campaign_drafts_audience_goal
  on public.campaign_drafts (audience, goal);
create index if not exists ix_campaign_drafts_channels
  on public.campaign_drafts using gin (channels);

create table if not exists public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  channel text not null check (channel in ('meta', 'email', 'whatsapp', 'push', 'landing')),
  format text not null,
  variant_name text not null,
  content jsonb not null default '{}'::jsonb,
  rationale text not null,
  status public.campaign_workflow_status not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_campaign_messages_campaign
  on public.campaign_messages (campaign_draft_id, created_at asc);
create index if not exists ix_campaign_messages_channel_status
  on public.campaign_messages (channel, status);

create table if not exists public.campaign_feedback (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  campaign_message_id uuid null references public.campaign_messages(id) on delete cascade,
  feedback_type public.campaign_feedback_type not null,
  feedback_note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ix_campaign_feedback_campaign_created
  on public.campaign_feedback (campaign_draft_id, created_at desc);
create index if not exists ix_campaign_feedback_message_created
  on public.campaign_feedback (campaign_message_id, created_at desc);

create table if not exists public.campaign_message_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_message_id uuid not null references public.campaign_messages(id) on delete cascade,
  version_number integer not null,
  source_action public.campaign_version_action not null,
  content jsonb not null default '{}'::jsonb,
  rationale text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_message_id, version_number)
);

create index if not exists ix_campaign_message_versions_message_created
  on public.campaign_message_versions (campaign_message_id, created_at desc);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tg_campaign_drafts_updated_at') then
    create trigger tg_campaign_drafts_updated_at
    before update on public.campaign_drafts
    for each row execute function public.tg_set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'tg_campaign_messages_updated_at') then
    create trigger tg_campaign_messages_updated_at
    before update on public.campaign_messages
    for each row execute function public.tg_set_updated_at();
  end if;
end $$;

alter table public.campaign_drafts enable row level security;
alter table public.campaign_messages enable row level security;
alter table public.campaign_feedback enable row level security;
alter table public.campaign_message_versions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_drafts' and policyname = 'campaign_drafts_read'
  ) then
    create policy campaign_drafts_read on public.campaign_drafts for select using (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_drafts' and policyname = 'campaign_drafts_insert'
  ) then
    create policy campaign_drafts_insert on public.campaign_drafts for insert with check (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_drafts' and policyname = 'campaign_drafts_update'
  ) then
    create policy campaign_drafts_update on public.campaign_drafts for update using (public.has_admin_access());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_messages' and policyname = 'campaign_messages_read'
  ) then
    create policy campaign_messages_read on public.campaign_messages for select using (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_messages' and policyname = 'campaign_messages_insert'
  ) then
    create policy campaign_messages_insert on public.campaign_messages for insert with check (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_messages' and policyname = 'campaign_messages_update'
  ) then
    create policy campaign_messages_update on public.campaign_messages for update using (public.has_admin_access());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_feedback' and policyname = 'campaign_feedback_read'
  ) then
    create policy campaign_feedback_read on public.campaign_feedback for select using (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_feedback' and policyname = 'campaign_feedback_insert'
  ) then
    create policy campaign_feedback_insert on public.campaign_feedback for insert with check (public.has_admin_access());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_message_versions' and policyname = 'campaign_message_versions_read'
  ) then
    create policy campaign_message_versions_read on public.campaign_message_versions for select using (public.has_admin_access());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_message_versions' and policyname = 'campaign_message_versions_insert'
  ) then
    create policy campaign_message_versions_insert on public.campaign_message_versions for insert with check (public.has_admin_access());
  end if;
end $$;
