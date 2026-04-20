# Handi Publishing Workflow

## Goal

Publishing stays behind explicit human approval.

This phase adds:

- publish readiness
- publish jobs
- retryable execution
- channel-specific connectors
- payload export for paid media

It does not add:

- autonomous publishing
- scheduling orchestration
- Meta or Google live delivery
- n8n

## Editorial State vs Publish State

Editorial state answers:

- is the campaign approved by a human?
- does it still need copy work?

Publish state answers:

- is the campaign allowed to enter publishing?
- is a publish job running?
- did the last publish/export succeed or fail?

The system only allows publish operations when:

- editorial `status` is `approved`
- publish `publish_status` is not `not_ready`

## Publish States

- `not_ready`
- `ready_to_publish`
- `publishing`
- `published`
- `publish_failed`
- `paused`
- `archived`

## Publish Jobs

Each publish attempt creates a row in `campaign_publish_jobs`.

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

This makes retries and debugging traceable.

## Supported Channels In Phase 7

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
- now includes signed callback metadata so service-worker delivery/click events can feed analytics

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
- no live API publishing

### Google ads

Mode support:

- `export`

Behavior:

- generates a structured payload for manual paid media setup
- no live API publishing

### Landing

Mode support:

- `draft`
- `export`

Behavior:

- prepares approved payloads for manual implementation
- no CMS publishing yet

## Admin Flow

1. Approve the campaign editorially.
2. Mark it `ready_to_publish`.
3. Start a publish job for a selected channel and mode.
4. Review the result in publish history.
5. Retry if it fails.
6. Pause if needed.

## Retry Behavior

Retry creates a new publish job.

It reuses:

- channel
- mode
- payload targeting data where applicable

The original failed job remains in history.

## Callback and Sync Support

Phase 10A adds pragmatic signal sync for internal channels.

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

## Idempotency

- provider callback rows are stored on `campaign_provider_events`
- each row uses a deterministic `dedupe_key`
- duplicate callbacks do not re-ingest analytics

This keeps retries safe without adding a job queue.

## Activity Feed Events

The admin detail feed now includes:

- marked ready to publish
- publish started
- publish succeeded
- publish failed
- paused
- retry requested
- export generated

## Current Limitations

- there is no schedule or queued worker yet
- a campaign does not yet choose a dedicated “winner variant”; the publish service picks the strongest current variant for the channel
- paid media exports are payload-only and not synced to external ad accounts
- WhatsApp live send is intentionally blocked
- landing publishing is still manual
- push delivery means the service worker received and displayed the notification, not guaranteed OS-level delivery
- no cross-channel deduplication is attempted
