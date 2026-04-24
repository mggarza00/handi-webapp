create table if not exists public.instrumentation_runtime_observations (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_source text not null,
  provider_target text not null default 'internal',
  journey text null,
  last_surface_id text null,
  last_route_path text null,
  last_dispatch_status text not null default 'success',
  last_observed_at timestamptz not null default timezone('utc', now()),
  last_success_at timestamptz null,
  last_failure_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint instrumentation_runtime_observations_source_check check (
    event_source in ('browser', 'server', 'imported', 'manual')
  ),
  constraint instrumentation_runtime_observations_provider_check check (
    provider_target in ('ga4', 'clarity', 'internal')
  ),
  constraint instrumentation_runtime_observations_dispatch_status_check check (
    last_dispatch_status in ('success', 'skipped', 'failed')
  ),
  constraint instrumentation_runtime_observations_unique_event_provider unique (
    event_name,
    event_source,
    provider_target
  )
);

create index if not exists ix_instrumentation_runtime_observations_event
  on public.instrumentation_runtime_observations (event_name, event_source);

create index if not exists ix_instrumentation_runtime_observations_status
  on public.instrumentation_runtime_observations (last_dispatch_status, last_observed_at desc);

create index if not exists ix_instrumentation_runtime_observations_journey
  on public.instrumentation_runtime_observations (journey, last_observed_at desc);
