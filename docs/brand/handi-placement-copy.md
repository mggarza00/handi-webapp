# Handi Placement Copy

## Goal

Placement copy lets Handi keep one selected channel message as the base truth while allowing tighter copy overrides for placements that need it.

This keeps paid handoff more realistic without turning the admin into a full ad-builder.

## Refined Paid Placement Taxonomy

Placement-specific copy is now especially useful for:

- `meta_feed_square`
- `meta_feed_portrait`
- `meta_story_vertical`
- `meta_reel_vertical`
- `meta_right_column_landscape`
- `google_display_landscape`
- `google_display_square`
- `google_responsive_display_landscape`
- `google_responsive_display_square`

Owned channels like landing/email/push/whatsapp still support placement-aware copy, but Meta and Google are the main paid-ops targets for tighter overrides.

## Data Model

Placement-aware copy is stored in `campaign_message_placements`.

Each record stays linked to:

- `campaign_draft_id`
- `campaign_message_id` as the base channel message
- `channel`
- `placement_id`

And stores:

- `headline`
- `body`
- `cta`
- `rationale`
- `qa_report`
- `provider_metadata`
- `status`
- `source`

## Resolution Rules

Handi resolves placement copy conservatively:

1. If an approved placement-specific record exists for the selected base message, use it.
2. If no approved placement record exists, inherit the selected channel-level message.
3. If the channel has no usable selected message, the placement copy is missing.

Pending or rejected placement proposals do not override export output until they are approved.

This means the placement handoff layer stays conservative:

- inherited copy is still valid output
- approved placement-specific copy wins over inheritance
- manual override remains explicit and reviewable

## Sources

- `inherited`
  The placement is using the selected channel-level message.
- `ai_generated`
  The placement copy was generated from the campaign brand/prompt stack and still requires approval.
- `manual_override`
  The placement copy was edited directly in admin and still follows the same review gate.

## Review Flow

Placement copy proposals now support:

- generate proposal
- manual override
- approve
- reject and fall back to inheritance

The campaign detail view shows:

- base channel copy
- placement-specific status/source
- rationale summary
- QA score
- export/download links that use the resolved placement copy

## Export / Bundle Behavior

Placement export packages and download bundles now include:

- `baseMessageId`
- `placementMessageId`
- `source`
- `placementStatus`
- `inheritedFromChannel`

If a placement still inherits channel copy, the package stays usable but emits a warning so paid ops can decide whether tighter copy is needed.

## QA

Placement copy reuses the message QA heuristics already used for channel messages:

- clarity
- CTA strength
- channel fit
- brand fit
- risk

This keeps review consistent without duplicating a separate QA system.

## Activity Feed

Relevant events:

- `placement_copy_generated`
- `placement_copy_manual_override`
- `placement_copy_approved`
- `placement_copy_rejected`
- `placement_copy_inherited`
- `placement_copy_used_in_export`

Paid handoff exports may additionally surface:

- `paid_handoff_generated`
- `paid_handoff_exported`
- `paid_placement_ready`
- `paid_placement_warning_emitted`
- `paid_placement_missing_detected`

## Current Limitations

- placement copy is tied to the selected base message, so if variant selection changes the placement may fall back to inheritance
- there is no separate version history table for placement copy yet
- google placements remain constrained by the current channel/message model
- placement copy guidance is preset-driven; it is not yet connected to a richer per-platform ad spec library

## Natural Next Steps

- add explicit clear/archive actions for placement overrides
- add optional placement-copy version history if paid ops needs deeper auditability
- support richer placement-specific prompt presets per connector/export target
