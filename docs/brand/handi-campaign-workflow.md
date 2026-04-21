# Handi Campaign Workflow

## Goal

This workflow keeps campaign generation, review, and editing fully internal to Handi.

Core rule:

- Agents propose.
- Admin reviews, edits, assigns, comments, approves, rejects, or requests changes.
- Nothing publishes without explicit admin action.
- Paid media stays in draft/export mode in this phase.

## Current Vertical Slice

The workflow now covers:

1. Create a brief in `/admin/campaigns/new`.
2. Generate a persisted campaign draft with one or more message variants.
3. Review the draft in `/admin/campaigns`.
4. Open the full detail in `/admin/campaigns/[id]`.
5. Approve, reject, request changes, edit copy, regenerate a variant, assign an owner, update the checklist, add internal notes, or reanalyze QA.
6. Mark approved campaigns ready to publish, trigger controlled publish jobs, retry failures, or export paid media payloads.
7. Track versions, QA state, publish state, activity, duplication origin, and workflow history.
8. Ingest performance snapshots and funnel events, review analytics in admin, and export reports.
9. Use sufficient-data flags and conservative winner selection where reliable internal signal exists.
10. Create, review, version, and approve static campaign image assets from the same admin workflow.

## Admin Brief Flow

The admin brief page captures:

- title
- audience
- goal
- channels
- service category
- offer
- CTA
- journey trigger
- optional tone preference
- notes

The same page also supports duplication through `/admin/campaigns/new?from={campaignId}`:

- the source campaign pre-fills the new brief
- the new draft keeps a reference to the source campaign
- the activity feed shows that the new campaign came from duplication

When the brief is submitted:

- the proposal is generated with the Handi brand rules
- the draft and message variants are persisted
- provider metadata is stored on the campaign
- provider metadata is also stored on each current message and each saved version
- the admin is redirected to the campaign detail view

## Persisted Data

### campaign_drafts

Stores:

- campaign metadata
- rationale summary
- recommended angle
- workflow status
- brand context snapshot
- channel plan snapshot
- KPI suggestions snapshot
- owner assignment
- review checklist
- provider metadata
- optional source campaign reference

### campaign_messages

Stores:

- current active content payload
- current rationale
- channel and format
- provider metadata for the active variant
- current workflow status

### campaign_feedback

Stores:

- approve
- reject
- request_changes
- edit
- regenerate
- admin note
- actor and timestamp

### campaign_message_versions

Stores:

- initial generation
- every manual edit
- every regeneration
- provider metadata for that version snapshot
- content snapshot and rationale snapshot

### campaign_internal_notes

Stores:

- free-form collaboration notes
- author
- timestamp

Notes do not change workflow state on their own.

### campaign_publish_jobs

Stores:

- one publish attempt per channel and trigger
- publish mode (`live`, `draft`, `export`)
- provider/connector used
- response summary
- payload snapshot
- external reference when available
- error message when the job fails
- actor and timestamps

### campaign_performance_metrics

Stores:

- campaign, message, or publish-job performance snapshots
- channel attribution
- source of the snapshot
- raw counts such as deliveries, opens, clicks, conversions, and failures
- derived rates such as CTR, open rate, click-to-open rate, conversion rate, delivery rate, and failure rate
- spend and revenue when available
- recorded timestamp

### campaign_performance_events

Stores:

- delivered
- opened
- clicked
- engaged
- converted
- failed
- replied
- optional user or target identifier
- source
- metadata
- event timestamp

### campaign_variant_decisions

Stores:

- per-variant decision status
- whether the decision came from a rule or from a manual override
- whether enough data exists
- the reason behind sufficient-data and winner logic
- actor and timestamps

### audit_log

Stores activity events used by the admin feed, including:

- campaign generated
- campaign duplicated
- owner assigned or cleared
- checklist updated
- creative asset job created
- creative assets generated
- creative asset regenerated
- creative asset approved
- creative asset rejected
- creative asset changes requested
- creative asset version created
- approved
- rejected
- changes requested
- internal note added
- message edited
- message regenerated
- archived
- analytics compared
- trends recalculated
- sufficient data flagged
- winner selected
- winner reverted
- manual decision recorded
- automatic candidate detected

## Workflow States

- `draft`
  Reserved for incomplete work.

- `proposed`
  Generated and ready for admin review.

- `changes_requested`
  Needs another pass before approval.

- `approved`
  Accepted for internal readiness.

- `rejected`
  Explicitly declined.

- `archived`
  Kept only as history.

## Publish States

Publishing state is separate from editorial state.

- `not_ready`
  The campaign cannot publish yet.

- `ready_to_publish`
  Approved and explicitly cleared for publish operations.

- `publishing`
  A publish job is currently running.

- `published`
  The latest publish/export job completed successfully.

- `publish_failed`
  The latest publish job failed and needs review or retry.

- `paused`
  Publishing is intentionally paused.

- `archived`
  The campaign should not be published anymore.

## Ownership

Campaigns now support ownership at the draft level.

The detail page lets the team:

- assign an owner
- reassign an owner
- clear the owner
- take ownership directly

The list page supports filtering by owner and shows:

- current owner
- who created the campaign

## Editorial Checklist

Each campaign includes a simple persisted checklist:

- aligned to brand
- message clear
- CTA correct
- audience correct
- channel correct
- no risky claims
- ready for approval

The checklist is visible and editable on the campaign detail page. It does not auto-approve anything; it exists to support human review.

## Internal Notes

Internal notes are separate from:

- rationale generated by AI
- structured workflow feedback such as approve or reject

Use notes for team collaboration, context handoff, and reviewer comments that should not mutate status.

## List View

`/admin/campaigns` supports:

- search by title
- filters by status
- filters by audience
- filters by channel
- filters by goal
- filters by owner
- filters by publish status
- ordering by `updated_at`
- result count
- batch approve
- batch reject
- batch archive

Each row surfaces:

- variant count
- current status
- current publish status
- whether manual edits exist
- whether regenerated variants exist
- whether changes were requested before
- provider used for generation
- latest publish error when applicable
- publish job count
- owner
- creator
- duplication origin when applicable
- last activity timestamp

## Detail View

`/admin/campaigns/[id]` highlights:

- campaign summary
- rationale summary
- recommended angle
- brand context summary
- KPI suggestions
- channel plan
- owner assignment
- editorial checklist
- publishing state
- publish actions
- publish history
- performance summary
- current vs previous comparison
- trend summary by campaign and channel
- sufficient-data and decision-support state
- winner state by channel when available
- variant performance
- recent funnel events
- learning-loop recommendations
- export payload preview
- source campaign link when duplicated
- internal notes
- messages grouped by channel
- rationale by variant
- version comparison
- version history
- activity feed

## Rationale Format

Message rationale is normalized into a short readable structure:

- Angle
- Audience intent
- Why this channel
- Why this CTA
- Note (optional)

The DB still stores rationale as text, but the text follows a consistent labeled format so the admin can read it quickly and the UI can parse it safely.

## Version Comparison

The detail page compares:

- original version
- current version

and also shows a chronological version history using `campaign_message_versions`.

## Activity Feed

The activity feed is human-readable and chronological.

It shows:

- campaign generated
- campaign duplicated
- owner assigned or cleared
- checklist updated
- campaign approved
- campaign rejected
- changes requested
- internal note added
- message edited
- message regenerated
- marked ready to publish
- publish started
- publish succeeded
- publish failed
- paused
- retry requested
- export generated
- metrics ingested
- performance updated
- analytics compared
- trends recalculated
- sufficient data flagged
- winner selected
- winner reverted
- manual decision recorded
- automatic candidate detected
- recommendations recalculated
- analytics exported

## Analytics

`/admin/campaigns/analytics` provides a first operational reporting layer for the Campaign & Content OS.

It includes:

- aggregated performance by campaign
- current vs previous range comparisons
- trend summaries
- channel breakdown
- top variants
- publish-job performance
- recommendation cards generated from current data
- JSON and CSV exports

Filtering currently supports:

- date range
- channel
- workflow status
- audience
- goal
- sufficient data
- winner present
- decision eligibility

## Decision Support Scope

Variant selection is intentionally conservative in this phase.

Auto-decision support is currently limited to:

- `email`
- `push`

These channels still require:

- approved editorial state
- live internal publish data
- enough reliable volume before a variant can move beyond `insufficient_data`

The following channels remain manual-only:

- `meta`
- `google`
- `whatsapp`
- `landing`

## Attribution Scope

Attribution in this phase is intentionally simple.

Events and metrics can be linked to:

- campaign
- message variant
- publish job
- channel
- optional target identifier

This is useful for internal learning, but it is not a complete cross-channel attribution model yet.

- archived

Each item includes:

- timestamp
- actor
- short description
- message reference when applicable

## Provider Architecture

Provider selection now goes through `lib/ai/provider.ts`.

Current providers:

- `mock`
- `openai`

Behavior:

- `HANDI_AI_PROVIDER=mock` uses the deterministic internal provider
- `HANDI_AI_PROVIDER=openai` enables live OpenAI generation when the required env vars exist
- if `OPENAI_API_KEY` is missing, if structured validation fails, or if the provider call errors, the workflow falls back safely to mock output
- regeneration uses `OPENAI_REASONING_MODEL` when present; otherwise it uses `OPENAI_MODEL`

Generation and regeneration now persist:

- active provider
- provider status note
- generation mode (`mock`, `live`, `fallback`)
- model
- generated timestamp
- fallback reason when applicable
- request ID when available

The admin detail view now shows:

- whether a campaign or variant came from live generation, mock generation, or fallback
- which model was used
- whether a regeneration came from feedback
- fallback details when the provider had to degrade safely

## Automatic QA Layer

Campaigns and active message variants now persist a deterministic QA report.

The QA layer is internal only:

- it helps prioritize review
- it highlights likely issues before a human opens the draft
- it never publishes anything
- it never replaces admin approval

The engine runs automatically when:

- a campaign is generated
- a single content draft is generated
- a message is edited manually
- a message is regenerated from feedback

The admin can also re-run QA manually from the detail page with:

- `POST /api/admin/campaigns/[id]/reanalyze`

The campaign list now surfaces:

- `qa_status`
- `overall_score`
- warning count
- reviewer priority

The detail view now surfaces:

- campaign QA summary
- campaign warnings and suggestions
- per-variant QA scores
- per-variant warnings and suggestions
- ready-for-review vs needs-attention vs high-risk state

See also:

- `docs/brand/handi-campaign-qa.md`
- `docs/brand/handi-publishing-workflow.md`

See also:

- `docs/brand/handi-llm-provider.md`

## Demo Seed

For local validation, use the dev-only seed in `/api/dev/seed-campaigns`.

From `/admin/campaigns`, the UI can:

- seed realistic demo campaigns
- reset the seeded campaigns

The seeded data includes:

- client and professional audiences
- acquisition, activation, reactivation, and conversion goals
- meta, email, whatsapp, push, and landing channels
- proposed, approved, changes_requested, rejected, and archived examples
- manual edits
- regenerations
- feedback and activity history

## Current Limitations

- No fully automated external publishing
- No n8n orchestration
- No scheduling layer
- No analytics dashboard yet
- QA is heuristic and deterministic, not semantic understanding
- QA can flag likely issues, but it can still miss nuanced editorial or legal risks
- Campaign-level QA is derived from the currently active variants only
- Live OpenAI output is constrained to structured campaign copy generation and regeneration only
- Live generation still depends on prompt quality and local schema validation
- Fallback keeps the workflow safe, but the content may become more generic when the provider degrades to mock
- Checklist is advisory only; approval is still a human decision
- Owner assignment uses current admin reviewer options and does not yet include workload balancing or notifications
- Email can publish live only to explicit recipients provided by admin
- Push can publish live only with explicit target user IDs and configured VAPID keys
- WhatsApp remains draft/export only in this phase
- Meta and Google remain export-only in this phase
- Landing remains manual draft/export only in this phase

## Recommended Next Steps

1. Add reviewer notifications and ownership handoff rules.
2. Tune QA heuristics with real reviewer feedback and false-positive tracking.
3. Add schedule windows, holdouts, and richer targeting controls for publish jobs.
4. Add duplicate-and-regenerate flows for entire campaigns, not only brief prefill.
