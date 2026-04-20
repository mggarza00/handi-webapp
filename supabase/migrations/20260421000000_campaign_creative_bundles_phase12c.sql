create table if not exists public.campaign_creative_bundles (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  channel text not null,
  selected_master_asset_id uuid null references public.creative_assets(id) on delete set null,
  selected_derivative_asset_id uuid null references public.creative_assets(id) on delete set null,
  required_format text not null,
  suitability_status text not null default 'missing',
  selection_source text not null default 'inferred',
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campaign_creative_bundles_unique_channel unique (campaign_draft_id, channel),
  constraint campaign_creative_bundles_suitability_status_check check (
    suitability_status in ('ready', 'missing', 'partial', 'manual_override')
  ),
  constraint campaign_creative_bundles_selection_source_check check (
    selection_source in ('manual', 'inferred', 'channel_default')
  )
);

create index if not exists ix_campaign_creative_bundles_campaign
  on public.campaign_creative_bundles (campaign_draft_id, channel);

create index if not exists ix_campaign_creative_bundles_master_asset
  on public.campaign_creative_bundles (selected_master_asset_id);

create index if not exists ix_campaign_creative_bundles_derivative_asset
  on public.campaign_creative_bundles (selected_derivative_asset_id);
