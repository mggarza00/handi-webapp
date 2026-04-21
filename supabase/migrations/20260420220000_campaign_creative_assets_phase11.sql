create table if not exists public.creative_asset_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  campaign_message_id uuid null references public.campaign_messages(id) on delete set null,
  channel text not null,
  asset_type text not null default 'image',
  generation_status text not null default 'proposed',
  provider_name text not null default 'mock',
  provider_mode text not null default 'mock',
  brief_summary text not null default '',
  rationale_summary text not null default '',
  brief_payload jsonb not null default '{}'::jsonb,
  provider_metadata jsonb null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  creative_asset_job_id uuid not null references public.creative_asset_jobs(id) on delete cascade,
  variant_label text not null,
  format text not null,
  storage_path text not null,
  prompt_text text not null default '',
  rationale text not null default '',
  status text not null default 'proposed',
  is_current boolean not null default true,
  provider_metadata jsonb null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.creative_asset_versions (
  id uuid primary key default gen_random_uuid(),
  creative_asset_id uuid not null references public.creative_assets(id) on delete cascade,
  version_number integer not null,
  storage_path text not null,
  prompt_text text not null default '',
  rationale text not null default '',
  edited_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (creative_asset_id, version_number)
);

create table if not exists public.creative_asset_feedback (
  id uuid primary key default gen_random_uuid(),
  creative_asset_job_id uuid not null references public.creative_asset_jobs(id) on delete cascade,
  creative_asset_id uuid null references public.creative_assets(id) on delete set null,
  feedback_type text not null,
  feedback_note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists ix_creative_asset_jobs_campaign
  on public.creative_asset_jobs (campaign_draft_id, updated_at desc);

create index if not exists ix_creative_asset_jobs_status
  on public.creative_asset_jobs (generation_status, updated_at desc);

create index if not exists ix_creative_asset_jobs_message
  on public.creative_asset_jobs (campaign_message_id);

create index if not exists ix_creative_assets_job
  on public.creative_assets (creative_asset_job_id, updated_at desc);

create index if not exists ix_creative_assets_status
  on public.creative_assets (status, updated_at desc);

create index if not exists ix_creative_asset_feedback_job
  on public.creative_asset_feedback (creative_asset_job_id, created_at desc);

create or replace function public.tg_set_updated_at_creative_asset_jobs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end
$$;

drop trigger if exists trg_creative_asset_jobs_set_updated_at on public.creative_asset_jobs;
create trigger trg_creative_asset_jobs_set_updated_at
before update on public.creative_asset_jobs
for each row execute procedure public.tg_set_updated_at_creative_asset_jobs();

create or replace function public.tg_set_updated_at_creative_assets()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end
$$;

drop trigger if exists trg_creative_assets_set_updated_at on public.creative_assets;
create trigger trg_creative_assets_set_updated_at
before update on public.creative_assets
for each row execute procedure public.tg_set_updated_at_creative_assets();

do $$
begin
  raise notice 'Skipping SQL bucket creation for campaign-creative-assets. Create it from Supabase Storage or let the app service-role helper create it on first upload.';
end $$;
