# Handi Paid Handoff

## Goal

Paid handoff is the placement-aware layer that turns Campaign OS decisions into something a paid media operator can actually traffic.

It sits between:

- campaign review and approval
- creative bundle resolution
- export JSON / ZIP bundle download

It does not publish live to Meta or Google yet.

## Current Placement Taxonomy

### Meta

- `meta_feed_square`
- `meta_feed_portrait`
- `meta_story_vertical`
- `meta_reel_vertical`
- `meta_right_column_landscape`

### Google

- `google_display_landscape`
- `google_display_square`
- `google_responsive_display_landscape`
- `google_responsive_display_square`

### Owned surfaces kept in the same model

- `landing_hero`
- `landing_secondary_banner`
- `email_primary`
- `push_primary`
- `whatsapp_primary`

## What The Paid Handoff Layer Resolves

For each placement it resolves:

- placement definition
- operational placement name
- copy source
- copy style guidance
- selected visual asset
- exact vs fallback coverage
- readiness state
- warnings
- tracking contract
- recommended file stem for exports

This is exposed through `lib/creative/paid-handoff.ts`.

## Placement Rules

Each placement definition now centralizes:

- expected format
- preferred dimensions
- acceptable fallback formats
- whether fallback is allowed
- whether fallback blocks assisted handoff
- copy style
- copy guidance
- naming hint
- operational notes

Examples:

- Meta feed placements prefer tighter copy and stricter exact visual coverage.
- Meta story/reel placements can accept approved portrait fallback, but they still warn.
- Google responsive display placements are slightly more tolerant than static display placements.
- Right-column and static display placements push shorter, more utility-first copy.

## Copy + Visual Resolution

Paid handoff keeps the existing conservative rules:

1. Resolve the approved placement-specific copy when available.
2. Otherwise inherit the currently selected channel message.
3. Resolve the best approved visual asset for the placement.
4. Prefer exact format coverage over fallback.
5. Keep warnings visible when copy is inherited or the visual is fallback-only.

## Export Output

Placement JSON and ZIP output now include a `paidHandoff` block with:

- `platformLabel`
- `placementGroup`
- `operationalName`
- `namingHint`
- `recommendedFileStem`
- `copy.source`
- `copy.sourceLabel`
- `copy.inheritedFromChannel`
- `visual.exact`
- `visual.selectionSource`
- `readiness.state`
- `readiness.isReadyForPaidHandoff`
- `warnings`
- `notes`

This makes the export more useful for media buyers without introducing live publishing.

## ZIP Bundle Notes

Placement and channel ZIP bundles now include a lightweight `README.txt` that summarizes:

- campaign
- placement or channel
- copy source
- exact vs fallback visual state
- readiness
- operational warnings

This is intended as a practical handoff artifact, not as a long-form document.

## Admin View

The campaign detail view now shows paid placements more explicitly by surfacing:

- platform / operational placement name
- copy treatment
- exact vs fallback asset state
- inherited vs placement-specific copy
- placement-level export JSON
- placement-level ZIP download

## Activity Feed

Paid handoff now emits dedicated signals such as:

- `paid_handoff_generated`
- `paid_handoff_exported`
- `paid_placement_ready`
- `paid_placement_warning_emitted`
- `paid_placement_missing_detected`

Draft exporters now add:

- `paid_draft_generated`
- `paid_draft_downloaded`
- `paid_draft_warning_emitted`
- `paid_draft_blocked`
- `paid_draft_included_in_bundle`

These sit alongside the existing placement copy and bundle events.

## Current Limitations

- taxonomy is improved but still not exhaustive across every Meta/Google subtype
- paid handoff is export-only; there is still no external draft creation
- paid handoff now includes operator-friendly draft payloads, but they are still file-based exports rather than platform API drafts
- placement copy is still tied to the selected base message
- warnings are heuristic and operational, not a substitute for media-buyer review
- video and motion placements are still out of scope

## Natural Next Steps

- extend placement taxonomy only where ops actually needs more granularity
- connect paid handoff manifests to future draft exporters
- add more explicit placement-level trafficking notes where external platform quirks matter
- introduce optional per-placement creative checklists if paid ops needs them
