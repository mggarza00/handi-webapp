alter table public.campaign_publish_jobs
  add column if not exists scheduled_for timestamptz null,
  add column if not exists execution_window_start timestamptz null,
  add column if not exists execution_window_end timestamptz null,
  add column if not exists queue_status text not null default 'completed',
  add column if not exists retry_count integer not null default 0,
  add column if not exists max_retries integer not null default 2,
  add column if not exists next_retry_at timestamptz null,
  add column if not exists last_error text null,
  add column if not exists locked_at timestamptz null,
  add column if not exists locked_by text null,
  add column if not exists triggered_manually boolean not null default false;

update public.campaign_publish_jobs
set queue_status = case
  when publish_status = 'published' then 'completed'
  when publish_status = 'publish_failed' then 'failed'
  when publish_status = 'paused' then 'paused'
  when publish_status = 'archived' then 'cancelled'
  when publish_status = 'publishing' then 'running'
  when publish_status = 'ready_to_publish' then 'ready'
  when completed_at is not null then 'completed'
  else 'queued'
end
where queue_status is null
   or queue_status = '';

create index if not exists ix_campaign_publish_jobs_queue_status
  on public.campaign_publish_jobs (queue_status, scheduled_for asc, next_retry_at asc);

create index if not exists ix_campaign_publish_jobs_due
  on public.campaign_publish_jobs (scheduled_for asc, next_retry_at asc)
  where queue_status in ('queued', 'scheduled', 'ready', 'failed');

create index if not exists ix_campaign_publish_jobs_draft_queue
  on public.campaign_publish_jobs (campaign_draft_id, queue_status, scheduled_for desc);
