alter table public.campaign_publish_jobs
  add column if not exists error_type text null,
  add column if not exists deferred_reason text null;

create index if not exists ix_campaign_publish_jobs_error_type
  on public.campaign_publish_jobs (error_type)
  where error_type is not null;

create index if not exists ix_campaign_publish_jobs_deferred_reason
  on public.campaign_publish_jobs (deferred_reason)
  where deferred_reason is not null;
