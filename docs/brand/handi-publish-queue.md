# Handi Publish Queue

## Goal

Phase 10B adds an internal scheduling and queue layer on top of approved campaigns.

It keeps the existing human gate intact:

- editorial approval still comes first
- publish readiness still has to be explicit
- the queue never bypasses admin review
- there is still no paid media live publishing

## Queue Model

The queue extends `campaign_publish_jobs`. Each row is now both:

- the publish execution record
- the scheduling and retry record

Key fields:

- `scheduled_for`
- `execution_window_start`
- `execution_window_end`
- `queue_status`
- `retry_count`
- `max_retries`
- `next_retry_at`
- `last_error`
- `error_type`
- `deferred_reason`
- `locked_at`
- `locked_by`
- `triggered_manually`

## Queue States

- `queued`: ready for the next internal run, no fixed future time
- `scheduled`: has a future `scheduled_for` or `next_retry_at`
- `ready`: due and eligible to run
- `running`: locked and executing
- `completed`: finished successfully
- `failed`: failed and no retry is currently scheduled
- `paused`: intentionally held
- `cancelled`: invalidated or cancelled by admin

## Scheduling Rules

Scheduling only works when:

- campaign editorial `status` is `approved`
- campaign `publish_status` is `ready_to_publish`, `published`, or `publish_failed`

This keeps scheduling behind the same publish gate already used by manual publish.

## Channel Windows

Current behavior:

- `email`: supports scheduled live, draft, and export runs
- `push`: supports scheduled live, draft, and export runs
- `landing`: supports draft/export scheduling only
- `whatsapp`: supports draft/export scheduling only
- `meta`: supports export scheduling only
- `google`: supports export scheduling only

The queue validates execution windows when provided:

- `execution_window_start` must be before `execution_window_end`
- `scheduled_for` must fall inside the window when both exist
- jobs whose window expires before execution are marked `failed` with `error_type = expired_window`

## Manual and Cron-Compatible Execution

The queue does not require a dedicated worker.

Current entry points:

- detail page controls inside `/admin/campaigns/[id]`
- queue page at `/admin/campaigns/queue`
- `POST /app/api/admin/publish-jobs/run-due/route.ts`
- `POST /app/api/internal/publish-queue/run-due/route.ts`

This makes the queue compatible with:

- manual admin runs
- internal polling
- a cron trigger authenticated with `PUBLISH_QUEUE_CRON_SECRET` or `CRON_SECRET`

The internal route returns an operational summary:

- `jobs scanned`
- `jobs started`
- `jobs completed`
- `jobs failed`
- `jobs skipped`
- `retries scheduled`

## Throttling and Concurrency

The queue now applies simple channel-level operational guards.

Default per-run throttling:

- `email`: up to 5 jobs per run
- `push`: up to 4 jobs per run
- `whatsapp`: up to 8 jobs per run
- `landing`: up to 8 jobs per run
- `meta`: up to 10 jobs per run
- `google`: up to 10 jobs per run

Default concurrency guards against already-running work:

- `email`: max 2 running jobs, max 1 running job per campaign/channel
- `push`: max 2 running jobs, max 1 running job per campaign/channel
- export or draft-only channels: max 1 running job, max 1 running job per campaign/channel

When a limit is hit, the job is not lost. It stays in the queue with a `deferred_reason`:

- `channel_throttled`
- `concurrency_blocked`
- `retry_deferred`
- `lock_conflict`

## Retry Policy

Retries are conservative and transparent.

Recoverable errors:

- `recoverable_transient`
- `recoverable_rate_limited`

Non-recoverable errors:

- `configuration_error`
- `readiness_error`
- `approval_error`
- `unsupported_channel`
- `targeting_error`
- `expired_window`
- `lock_conflict`
- `unknown_error`

Backoff:

- transient retry 1: 15 minutes
- transient retry 2: 60 minutes
- transient retry 3+: 180 minutes, capped by `max_retries`
- rate-limited retry 1: 30 minutes
- rate-limited retry 2: 120 minutes
- rate-limited retry 3+: 360 minutes, capped by `max_retries`

Default:

- `max_retries = 2`

If retries are exhausted, the job remains `failed` and requires a human action.

## Queue Health

The queue page now surfaces a compact health summary based on:

- ready jobs
- running jobs
- recent failures
- pending retries
- throttled jobs
- concurrency-blocked jobs
- last `run-due` execution summary

Health states:

- `healthy`: no active queue pressure or recent failures
- `attention`: work is pending or retries are queued
- `degraded`: recent failures need review

## Variant Selection Policy

The queue runner uses this priority order:

1. explicit `message_id` already attached to the job
2. manual `winner` decision for the channel
3. rule-based `winner` with `decision_eligibility = eligible`
4. strongest approved current variant for the channel
5. final QA-ranked fallback across allowed channel variants

This keeps the selection explicit and predictable without pretending there is a fully automated final editorial winner.

## Invalidating Scheduled Jobs

If a campaign leaves `approved`, pending jobs are cancelled.

This happens for example when:

- changes are requested
- content is edited and the campaign reopens
- content is regenerated and the campaign reopens
- the campaign is archived

The policy is simple:

- previously scheduled jobs are invalidated
- the campaign must be revalidated and scheduled again

## Activity Feed Events

The audit feed now records:

- publish scheduled
- publish unscheduled
- queue job ready
- queue job started
- queue job completed
- queue job failed
- retry scheduled
- retry exhausted
- queue job cancelled
- queue job run manually
- queue run triggered
- queue run completed
- channel throttled
- concurrency blocked
- retry deferred
- error classified
- cron trigger called

## Current Limitations

- there is still no dedicated background worker
- queue execution is still manual or cron-compatible, not autonomous
- paid media remains export-only
- WhatsApp remains draft/export only
- there is still no send-time optimization
- throttling is channel-local, not account-wide provider rate limiting
- concurrency is best-effort and designed for a single app instance, not a distributed fleet
