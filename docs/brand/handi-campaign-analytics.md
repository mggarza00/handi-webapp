# Handi Campaign Analytics

## Goal

This layer adds internal measurement and learning after a campaign is published or exported.

It is designed to:

- measure campaign, channel, variant, and publish-job performance
- keep attribution simple and traceable
- generate deterministic recommendations for the Handi team
- support review and planning without auto-optimizing or auto-publishing
- improve confidence on internal channels through real callbacks and sync-safe ingestion

It does not:

- replace human review
- push changes back into campaigns automatically
- provide perfect attribution
- optimize bids or audiences automatically

## Persisted Model

### `campaign_performance_metrics`

Stores performance snapshots.

Each row can be linked to:

- `campaign_draft_id`
- `campaign_message_id` when the metric belongs to a specific variant
- `publish_job_id` when the metric belongs to a specific publish attempt
- `channel`

Supported metrics:

- impressions
- clicks
- opens
- replies
- deliveries
- conversions
- failures
- spend
- revenue
- ctr
- open_rate
- click_to_open_rate
- conversion_rate
- delivery_rate
- failure_rate
- recorded_at
- source

### `campaign_performance_events`

Stores funnel events and attribution hints.

Supported event types:

- delivered
- opened
- clicked
- engaged
- converted
- failed
- replied

Each row can also store:

- target user id when available
- target identifier such as an email or phone
- source
- metadata
- occurred_at

### `campaign_provider_events`

Stores normalized provider callbacks and sync events before they are turned into analytics.

Each row keeps:

- provider name
- raw provider event type
- normalized Handi event type when applicable
- dedupe key for idempotency
- event source such as `webhook` or `push_client`
- campaign, message, and publish-job linkage when resolvable
- processed status: `processed`, `ignored`, or `error`
- provider metadata and raw payload snapshot
- event timestamp

## Derived Metrics

Derived metrics are deterministic.

- CTR = `clicks / impressions * 100`
- Open rate = `opens / deliveries * 100`
- Click-to-open rate = `clicks / opens * 100`
- Conversion rate = `conversions / clicks * 100`
- Delivery rate = `deliveries / max(impressions, deliveries + failures) * 100`
- Failure rate = `failures / (deliveries + failures) * 100`

If the denominator is `0`, the derived rate is `null`.

## Ingest Flow

Endpoint:

- `POST /app/api/admin/analytics/ingest/route.ts`

Use it to:

- ingest manual snapshots
- ingest event batches
- record results from live internal sends

The endpoint:

1. validates payloads with Zod
2. persists metrics and events
3. recalculates campaign-level summaries on read
4. logs audit events for metrics ingestion, performance updates, and recommendation recalculation

## Live Signal Sync

Phase 10A adds pragmatic live-signal ingestion for internal channels.

### Email

- Live email still sends through Resend.
- Approved publish jobs store the Resend email ID on `campaign_publish_jobs.external_reference_id`.
- `POST /app/api/webhooks/resend/route.ts` receives verified Resend webhook events.
- Supported normalized signals:
  - `email.delivered` -> `delivered`
  - `email.opened` -> `opened`
  - `email.clicked` -> `clicked`
  - `email.bounced`, `email.failed`, `email.complained`, `email.delivery_delayed` -> `failed`

Important:

- send success is no longer treated as a delivery
- delivery/open/click quality now depends on real callbacks
- `RESEND_WEBHOOK_SECRET` is required for secure verification

### Push

- Web push still uses explicit user IDs and existing VAPID keys.
- Delivery is treated conservatively:
  - live publish can record dispatch failures
  - real `delivered` and `clicked` signals come from the service worker callback route
- `POST /app/api/push/events/route.ts` ingests signed push callback events

Important:

- `delivered` means the browser service worker received the push and showed the notification
- it does not claim OS-level delivery certainty
- `clicked` is the strongest reliable interaction signal for push in this phase
- push callback signing uses `CAMPAIGN_SIGNAL_SECRET` when present, otherwise it falls back to `WEB_PUSH_VAPID_PRIVATE_KEY`

## Event Normalization

Internal normalization maps provider events into Handi analytics events through:

- provider name
- raw event type
- normalized event type
- publish job linkage
- campaign and message linkage
- target identifier when available
- source label such as `resend_webhook` or `push_callback`

This normalization happens before analytics ingestion so the rest of the system stays provider-agnostic.

## Idempotency

Phase 10A adds basic idempotency at provider-event level.

- provider callbacks are stored with a deterministic `dedupe_key`
- duplicate provider events are ignored safely
- analytics ingestion only runs for newly accepted normalized events

This prevents double counting from webhook retries or repeated client callbacks.

## Publish Hook

When a live internal publish succeeds or fails, the publish service writes a basic analytics snapshot automatically.

Current behavior:

- live email and live push create only conservative dispatch/failure snapshots when appropriate
- email delivery, open, and click data now depend on real Resend callbacks
- push delivery and click data can now come from real service worker callbacks
- draft/export jobs do not create delivery metrics automatically
- later opens, clicks, conversions, or replies still need ingest

This gives the team a starting signal without pretending attribution is complete.

## Signal Quality in Admin

Analytics and campaign detail now show a signal-quality summary:

- `live`
  reliable callback or sync signal is present

- `mixed`
  live callback signal exists, but manual or snapshot data still affects the view

- `manual`
  only manual or snapshot-style data exists

- `limited`
  there is not enough signal yet to trust automated comparisons

Admin can also see:

- last callback received
- last sync error
- sources contributing to the current view
- publish jobs with live vs limited signal

## Recommendations

Recommendations are deterministic and generated from current performance data.

Current examples:

- best channel for the campaign
- best-performing variant inside a channel
- high QA but weak conversion signal
- low-action campaigns that reach people but do not move them
- delivery risk warnings
- duplicate-and-test opportunities for the next brief

Recommendations are advisory only.

## Admin Surfaces

### `/admin/campaigns/analytics`

Shows:

- aggregate totals
- current vs previous range comparisons
- simple trend summaries by campaign, channel, and recent publish jobs
- channel breakdown
- top campaigns
- top variants
- publish-job performance
- learning-loop recommendations
- sufficient-data and winner-support filters

Filters:

- date range
- status
- audience
- goal
- channel
- sufficient data
- winner present
- decision eligibility

### `/admin/campaigns/[id]`

Shows:

- campaign performance summary
- current vs previous range comparison
- campaign and channel trend summaries
- channel breakdown
- variant performance
- decision support state per variant
- recent funnel events
- recommendations
- publish-job metrics

## Comparative Analytics

Comparisons use a simple current-vs-previous window.

- If the admin selects `from` and `to`, the system compares that window against the immediately previous window with the same length.
- If no range is selected, the system compares the latest 7-day window against the 7 days before it.
- Comparison is descriptive only. It helps the reviewer spot movement without implying causal attribution.

## Trend Lines

Trend points are day-bucketed summaries built from:

- the latest metric snapshot available for each day and scope
- incremental events recorded on that same day

This is intentionally conservative:

- manual snapshots can still make trend lines incomplete
- trend direction is only `up`, `down`, or `flat`
- trend summaries are decision support, not forecasting

## Sufficient Data and Decision Eligibility

Phase 9 adds explicit decision support flags for variant selection.

### Eligibility states

- `eligible`
  The channel supports conservative auto-decisioning and enough reliable live signal exists.

- `limited`
  The channel can eventually support auto-decisioning, but current signal is still too light or comes mostly from manual snapshots.

- `manual_only`
  The channel stays manual in this phase because it is still draft/export oriented.

- `not_supported`
  The variant or campaign is archived or outside decision scope.

### Current channel policy

- `email`
  Eligible for conservative auto-decisioning once delivery and engagement thresholds are met.

- `push`
  Eligible for conservative auto-decisioning once delivery and click thresholds are met.

- `meta`
  Manual only in this phase.

- `google`
  Manual only in this phase.

- `whatsapp`
  Manual only in this phase.

- `landing`
  Manual only in this phase.

### Current thresholds

- `email`
  Minimum `100` deliveries and either `20` opens or `8` clicks before the system treats a variant as having sufficient data.

- `push`
  Minimum `150` deliveries and `8` clicks before the system treats a variant as having sufficient data.

Reliable live signal is also required. If all data comes from manual or export-style snapshots, eligibility remains `limited`.

## Winner Selection

Winner selection is conservative on purpose.

- The system only attempts rule-based winner selection for `email` and `push`.
- The campaign must already be editorially approved.
- The campaign must also have a publish state of `published` or `paused`.
- If enough reliable data exists but the lead is not clearly decisive, the leading variant is marked as `candidate` instead of `winner`.
- Export-only or draft-heavy channels remain manual.

Possible decision states:

- `candidate`
- `winner`
- `loser`
- `insufficient_data`
- `manual_only`
- `archived`

Admins can override the decision manually from the campaign detail page. Manual decisions are logged in the activity feed.

## Exports

Endpoint:

- `GET /app/api/admin/campaigns/analytics/export`

Supported scopes:

- campaigns
- messages
- publish_jobs

Supported formats:

- JSON
- CSV

## Limitations

- attribution is basic and mostly scoped to campaign, message, and publish job
- event-level data can still be incomplete if providers do not send callbacks or the callback is not configured
- engaged events currently behave like a generic interaction signal and are not treated as a separate rate
- no cross-channel deduplication is attempted
- winner selection is intentionally limited to channels with enough reliable internal signal
- manual snapshots can keep a channel in `limited` mode even when totals look large
- there is no automated optimization loop yet
- paid media remains export-first and does not feed live platform metrics automatically
- push cannot guarantee a true open signal; click remains the stronger interaction event
- Meta and Google still depend on manual snapshots or exports, so they remain outside live signal support
