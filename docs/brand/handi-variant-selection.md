# Handi Variant Selection

## Goal

This layer helps the team decide when a published variant has enough trustworthy signal to be treated as:

- a candidate
- a winner
- a loser
- still insufficient
- manual only

It does not replace reviewer judgment. It only surfaces a conservative recommendation.

## Why It Exists

Current campaign analytics in Handi still have real limitations:

- no cross-channel deduplication
- no live Meta or Google platform sync
- some channels still depend on manual snapshots or export flows
- no sophisticated attribution model

Because of that, Phase 9 avoids pretending every channel can support auto-winner logic.

## Decision States

- `candidate`
  There is enough reliable data to consider the variant seriously, but the lead is not decisive enough yet.

- `winner`
  The variant is leading clearly enough inside an eligible channel, with enough reliable data, and under an approved/published campaign.

- `loser`
  Another variant in the same eligible channel is clearly outperforming it.

- `insufficient_data`
  Data is still too light or too unreliable to support a decision.

- `manual_only`
  The channel is not eligible for rule-based winner selection in this phase.

- `archived`
  The variant or campaign is no longer active for decision support.

## Decision Eligibility

- `eligible`
  The channel supports conservative rule-based selection and enough reliable live signal is present.

- `limited`
  The channel could become eligible later, but current signal is still too weak or too manual.

- `manual_only`
  The channel is out of auto-decision scope in this phase.

- `not_supported`
  The variant is archived or otherwise outside active selection scope.

## Channel Policy

### Email

Auto-decision eligible when:

- the campaign is approved
- the campaign has already been published or paused after publishing
- there are at least `100` deliveries
- there are at least `20` opens or `8` clicks
- the signal includes reliable live/internal sources rather than only manual snapshots

### Push

Auto-decision eligible when:

- the campaign is approved
- the campaign has already been published or paused after publishing
- there are at least `150` deliveries
- there are at least `8` clicks
- the signal includes reliable live/internal sources rather than only manual snapshots

### Manual-only Channels in Phase 9

- `meta`
- `google`
- `whatsapp`
- `landing`

These channels can still carry analytics snapshots and reviewer notes, but they do not enter auto-winner selection.

## Transparent Rules

The current system uses explicit rules:

1. Check whether the channel is eligible at all.
2. Check whether the campaign has the right editorial and publish state.
3. Check whether enough reliable data exists for that channel.
4. Rank variants within the same channel using simple business-first metrics.
5. Promote the leader to `winner` only if the gap is clear enough.
6. Otherwise keep the leader as `candidate`.

The rules are intentionally easy to inspect in code and easy to tune later.

## Manual Override

Admins can override the rule-based state from `/admin/campaigns/[id]`.

Supported manual states:

- `candidate`
- `winner`
- `loser`
- `insufficient_data`
- `manual_only`
- `archived`

Each override stores:

- status
- source (`manual`)
- reason
- actor
- timestamp

If an admin marks one variant as `winner`, the previous winner in the same campaign/channel is demoted automatically so the state stays coherent.

## Activity Feed

The activity feed can now show:

- analytics compared
- trend recalculated
- sufficient-data flag updated
- automatic candidate detected
- winner selected
- winner reverted
- manual decision recorded

## Limits

- no statistical significance testing
- no cross-channel attribution normalization
- no universal winner selection across export-only channels
- no automatic publish action based on winner state

This is decision support, not autonomous optimization.
