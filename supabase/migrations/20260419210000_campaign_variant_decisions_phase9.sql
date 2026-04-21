create table if not exists public.campaign_variant_decisions (
  id uuid primary key default gen_random_uuid(),
  campaign_draft_id uuid not null references public.campaign_drafts(id) on delete cascade,
  campaign_message_id uuid not null references public.campaign_messages(id) on delete cascade,
  channel text not null,
  decision_status text not null check (
    decision_status in (
      'candidate',
      'winner',
      'loser',
      'insufficient_data',
      'manual_only',
      'archived'
    )
  ),
  decision_source text not null default 'rule_based' check (
    decision_source in ('manual', 'rule_based')
  ),
  decision_eligibility text not null default 'limited' check (
    decision_eligibility in ('eligible', 'limited', 'manual_only', 'not_supported')
  ),
  sufficient_data boolean not null default false,
  sufficient_data_reason text,
  decision_reason text,
  decided_by uuid,
  decided_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists campaign_variant_decisions_message_key
  on public.campaign_variant_decisions(campaign_message_id);

create index if not exists campaign_variant_decisions_campaign_idx
  on public.campaign_variant_decisions(campaign_draft_id, channel);

create unique index if not exists campaign_variant_decisions_winner_per_channel_idx
  on public.campaign_variant_decisions(campaign_draft_id, channel)
  where decision_status = 'winner';
