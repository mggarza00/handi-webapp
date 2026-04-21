alter table if exists public.creative_asset_jobs
  add column if not exists job_type text not null default 'generation',
  add column if not exists parent_creative_asset_id uuid null,
  add column if not exists target_channel text null,
  add column if not exists target_width integer null,
  add column if not exists target_height integer null,
  add column if not exists adaptation_method text null;

alter table if exists public.creative_assets
  add column if not exists asset_role text not null default 'master',
  add column if not exists parent_asset_id uuid null,
  add column if not exists target_channel text null,
  add column if not exists target_width integer null,
  add column if not exists target_height integer null,
  add column if not exists adaptation_method text null,
  add column if not exists channel_suitability text[] not null default '{}'::text[];

alter table if exists public.creative_asset_versions
  add column if not exists format text,
  add column if not exists target_channel text null,
  add column if not exists target_width integer null,
  add column if not exists target_height integer null,
  add column if not exists adaptation_method text null,
  add column if not exists channel_suitability text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creative_asset_jobs_parent_creative_asset_id_fkey'
  ) then
    alter table public.creative_asset_jobs
      add constraint creative_asset_jobs_parent_creative_asset_id_fkey
      foreign key (parent_creative_asset_id)
      references public.creative_assets(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creative_assets_parent_asset_id_fkey'
  ) then
    alter table public.creative_assets
      add constraint creative_assets_parent_asset_id_fkey
      foreign key (parent_asset_id)
      references public.creative_assets(id)
      on delete set null;
  end if;
end $$;

update public.creative_asset_versions as versions
set format = assets.format
from public.creative_assets as assets
where versions.creative_asset_id = assets.id
  and (versions.format is null or versions.format = '');

alter table if exists public.creative_asset_versions
  alter column format set not null;

create index if not exists ix_creative_asset_jobs_job_type
  on public.creative_asset_jobs (job_type, updated_at desc);

create index if not exists ix_creative_asset_jobs_parent_asset
  on public.creative_asset_jobs (parent_creative_asset_id, updated_at desc);

create index if not exists ix_creative_assets_parent_asset
  on public.creative_assets (parent_asset_id, updated_at desc);

create index if not exists ix_creative_assets_role
  on public.creative_assets (asset_role, updated_at desc);
