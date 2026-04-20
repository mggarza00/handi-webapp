# Handi Publishing Workflow

## Goal

Publishing stays behind explicit human approval.

This workflow now includes:

- publish readiness
- publish jobs
- retryable execution
- internal scheduling
- queue states and locks
- channel-specific connectors
- payload export for paid media
- creative bundle resolution for approved visual assets

It still does not include:

- autonomous publishing
- Meta or Google live delivery
- n8n

## Editorial State vs Publish State

Editorial state answers:

- is the campaign approved by a human?
- does it still need copy work?

Publish state answers:

- is the campaign allowed to enter publishing?
- is a publish attempt running?
- did the last publish/export succeed or fail?

The system only allows publish operations when:

- editorial `status` is `approved`
- campaign `publish_status` is not `not_ready`

## Publish States

- `not_ready`
- `ready_to_publish`
- `publishing`
- `published`
- `publish_failed`
- `paused`
- `archived`

## Publish Jobs

Each publish attempt or scheduled queue item lives in `campaign_publish_jobs`.

That row stores:

- channel
- selected message when applicable
- publish mode
- connector/provider name
- response summary
- payload snapshot
- external reference ID when available
- error message when it fails
- who triggered it
- when it started and finished
- scheduling fields
- queue state
- retry metadata

See also:

- `docs/brand/handi-publish-queue.md`

## Supported Channels In Phase 10B

### Email

Mode support:

- `live`
- `draft`
- `export`

Live behavior:

- uses the existing Resend-based email layer
- requires explicit target recipients from admin
- sends only approved content
- stores the Resend email ID so webhook callbacks can attach real delivery/open/click signal later

### Web push

Mode support:

- `live`
- `draft`
- `export`

Live behavior:

- requires VAPID keys
- requires explicit target user IDs
- sends only approved content
- includes signed callback metadata so service-worker delivery/click events can feed analytics

### WhatsApp

Mode support:

- `draft`
- `export`

Live behavior:

- intentionally disabled in this phase

### Meta ads

Mode support:

- `export`

Behavior:

- generates a structured payload for manual paid media setup
- includes placement-aware readiness and asset selection for:
  - `meta_feed_square`
  - `meta_feed_portrait`
  - `meta_story_vertical`
- carries tracking contracts compatible with future GA4 and Clarity instrumentation
- no live API publishing

### Google ads

Mode support:

- `export`

Behavior:

- generates a structured payload for manual paid media setup
- includes placement-aware readiness and asset selection for:
  - `google_display_landscape`
  - `google_display_square`
- carries tracking contracts compatible with future GA4 and Clarity instrumentation
- no live API publishing

### Landing

Mode support:

- `draft`
- `export`

Behavior:

- prepares approved payloads for manual implementation
- now resolves placement-aware visual coverage for:
  - `landing_hero`
  - `landing_secondary_banner`
- no CMS publishing yet

## Admin Flow

1. Approve the campaign editorially.
2. Mark it `ready_to_publish`.
3. Either publish now or schedule a queue job for a selected channel and mode.
4. Review the result in publish history or in `/admin/campaigns/queue`.
5. Run now, retry, cancel, or reschedule as needed.
6. Pause if needed.

## Scheduling and Queue

Scheduling is intentionally simple:

- no external worker is required
- jobs can be run from admin
- jobs can also be executed through:
  - `POST /app/api/admin/publish-jobs/run-due/route.ts`
  - `POST /app/api/internal/publish-queue/run-due/route.ts`
- locks prevent duplicate execution of the same queued row
- cron-compatible execution is authenticated with `PUBLISH_QUEUE_CRON_SECRET` or `CRON_SECRET`

Operational guards:

- per-channel throttling limits how many jobs of the same channel can start in one batch
- simple concurrency guards prevent overlapping jobs for the same channel or campaign/channel combination
- queue health is surfaced in `/admin/campaigns/queue` and summarized in `/admin/campaigns`

Queue states:

- `queued`
- `scheduled`
- `ready`
- `running`
- `completed`
- `failed`
- `paused`
- `cancelled`

## Retry Behavior

Retries now happen on the same publish job row.

Rules:

- only recoverable failures are rescheduled
- retries use a simple backoff
- default `max_retries` is `2`
- error types are classified explicitly before deciding whether to retry
- non-recoverable failures stay failed and require human action
- cancelled, paused, archived, or no-longer-approved jobs are not retried

Error taxonomy:

- recoverable: `recoverable_transient`, `recoverable_rate_limited`
- non-recoverable: `configuration_error`, `readiness_error`, `approval_error`, `unsupported_channel`, `targeting_error`, `expired_window`, `lock_conflict`, `unknown_error`

## Variant Selection Policy

The publish runner uses this fallback order:

1. job-attached `message_id` when present
2. manual winner for the channel
3. eligible rule-based winner
4. strongest approved current variant
5. final QA-ranked fallback

## Creative Bundle Resolution

Publish and export preparation now resolve one visual bundle per channel through `campaign_creative_bundles`.

For paid/export channels, Handi now also derives placement-level readiness on top of the channel bundle so handoff can distinguish:

- exact placement coverage
- fallback placement coverage
- blocked placement gaps
- missing placement coverage

The current rules are:

1. prefer an approved derivative with the exact required format
2. otherwise use an approved master with the exact required format
3. otherwise use an approved fallback format when the channel allows it
4. otherwise mark the bundle as missing

Admin can override the selected visual manually from `/admin/campaigns/[id]`.

Current default expectations:

- `email` -> `landscape`
- `push` -> `square`
- `whatsapp` -> `portrait`
- `meta` -> `square`
- `google` -> `landscape`
- `landing` -> `landscape`

The prepared payload now includes visual bundle metadata, but this phase still does not auto-publish visuals externally.

## Visual Readiness Gates

Creative bundle resolution is not the same as visual readiness.

The system now evaluates each channel into one of these states:

- `ready_exact`
- `ready_fallback`
- `partial`
- `missing`
- `manual_override`
- `blocked`

Current policy in this phase:

- `email`, `push`, and `whatsapp` can proceed with approved fallback coverage
- `meta`, `google`, and `landing` require stricter exact coverage
- `missing` always means the channel still lacks a selected approved visual
- `blocked` means assisted publish should stop until the visual gap is resolved or a human override takes responsibility

This keeps three gates separate:

- editorial readiness
- publish readiness
- visual readiness

Export packages can still be generated for review, but publish assisted now refuses channels whose visual readiness is blocked.

See also:

- `docs/brand/handi-creative-bundles.md`
- `docs/brand/handi-creative-export-packages.md`

## Callback and Sync Support

Phase 10A added pragmatic signal sync for internal channels.

### Email callbacks

- `POST /app/api/webhooks/resend/route.ts`
- secure verification through `RESEND_WEBHOOK_SECRET`
- links provider callbacks back to publish jobs through `external_reference_id` and stored tags
- updates analytics, sufficient-data state, and winner support automatically

### Push callbacks

- `POST /app/api/push/events/route.ts`
- fed by the service worker after a notification is shown or clicked
- signed with internal tracking metadata
- updates analytics and downstream decision support automatically
- callback signing uses `CAMPAIGN_SIGNAL_SECRET` when present, otherwise it falls back to `WEB_PUSH_VAPID_PRIVATE_KEY`

## What Is Really Live vs Limited

### Live internal signal

- email delivered/opened/clicked through Resend callbacks
- push delivered and clicked through service-worker callbacks

### Limited or still manual

- email or push data before callbacks arrive
- manual analytics snapshots
- Meta and Google exports
- WhatsApp and landing draft/export flows
- visual delivery itself for all channels, including live email/push

## Idempotency

- provider callback rows are stored on `campaign_provider_events`
- each row uses a deterministic `dedupe_key`
- duplicate callbacks do not re-ingest analytics

This keeps retries safe without adding a distributed queue.

## Activity Feed Events

The admin detail feed now includes:

- marked ready to publish
- publish started
- publish succeeded
- publish failed
- paused
- retry requested
- export generated
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
- cron queue trigger called

## Current Limitations

- queue execution is still manual or cron-compatible, not a separate worker service
- there is no best-send-time optimization yet
- paid media exports are payload-only and not synced to external ad accounts
- WhatsApp live send is intentionally blocked
- landing publishing is still manual
- visuals are attached to payload/export preparation only; they are not pushed live to external media APIs in this phase
- push delivery means the service worker received and displayed the notification, not guaranteed OS-level delivery
- no cross-channel deduplication is attempted
- concurrency guards are designed for the current internal app flow, not a distributed worker fleet
