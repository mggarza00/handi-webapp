# Handi Campaign OS MVP

## Purpose

The current branch contains more capability than the team should operate day to day.

This document defines the practical MVP that Handi should use now:

- smaller default surface
- clearer operating flow
- less technical vocabulary in normal review
- advanced tooling still available, but parked behind explicit mode changes

## MVP Scope

The MVP answers one job well:

- create a campaign brief
- generate copy proposals
- review and refine copy
- optionally review one or more visual assets
- export a clean handoff package for the team

The MVP does **not** try to make every advanced subsystem part of the default operator experience.

## Basic Mode Is The Operational Truth

`basic` mode is the default operating mode for the Campaign OS admin.

It should be the mode used in normal internal work unless a reviewer explicitly needs deeper inspection.

Basic mode keeps the default flow focused on:

- campaign list
- new campaign brief
- campaign detail `Overview`
- campaign detail `Copy`
- campaign detail `Export / Handoff`

Basic mode intentionally hides or minimizes:

- queue controls
- retry and scheduling controls
- advanced provider metadata
- heavy analytics views
- activity-heavy audit depth
- deep placement nuance unless it is explicitly needed

## Advanced Mode

`advanced` mode exists to preserve already-built capability without making it compete for attention in the MVP flow.

Advanced mode can expose:

- deeper creative review
- analytics surfaces
- activity-heavy inspection
- publish queue controls
- provider metadata
- deeper placement detail

Advanced mode is for troubleshooting, specialist workflows, or deeper operational review, not for the default daily path.

## MVP Screens

### Visible In Basic Mode

- `/admin/campaigns`
- `/admin/campaigns/new`
- `/admin/campaigns/[id]`
  - `Overview`
  - `Copy`
  - `Export / Handoff`

### Available But Parked In Advanced Mode

- `/admin/creative-assets`
- `/admin/campaigns/analytics`
- `/admin/campaigns/queue`
- `Creativos` tab in campaign detail
- `Analytics` tab in campaign detail
- `Activity` tab in campaign detail

## MVP Workflow

1. Open `/admin/campaigns`.
2. Create a brief from `/admin/campaigns/new`.
3. Review the generated draft from campaign detail.
4. Use `Overview` for status, next action, and warnings.
5. Use `Copy` for variants, edits, approvals, and light QA guidance.
6. Use `Export / Handoff` for selected copy, selected asset, readiness, and downloads.
7. Open advanced mode only when deeper creative, queue, analytics, or audit work is required.

## Information Priority

### Critical In Basic Mode

- campaign title
- editorial status
- publish status
- visual readiness summary
- next best action
- critical warnings
- selected copy
- selected export / handoff package

### Secondary In Basic Mode

- rationale summary
- QA summary
- owner
- source campaign
- visual asset selection summary

### Advanced Metadata

- provider request IDs
- fallback internals
- queue internals
- runtime health
- detailed placement diagnostics
- version and provider detail not needed for the immediate decision

## Terminology Guidelines

Basic mode should prefer simple operational wording:

- `Overview` over strategy-heavy naming
- `Copy` over message architecture
- `Export / Handoff` over platform-specific trafficking language
- `Creative assets` only when visual review is needed
- `Advanced mode` instead of exposing specialist concepts everywhere

Words that should stay mostly out of the default path:

- throttling
- concurrency
- runtime health
- instrumentation coverage
- provider request IDs
- deep placement diagnostics

## Parking Lot / Not Now

These areas can remain in the codebase, but they should not lead the immediate roadmap or the default admin experience:

- publish queue sophistication
- retry and throttling expansion
- runtime instrumentation health expansion
- deeper analytics expansion
- winner-selection refinement
- very fine placement nuance beyond current paid handoff needs
- more paid draft complexity
- additional channel growth
- video workflow

## Consolidation Rules

When deciding whether something belongs in the default Campaign OS experience, use this filter:

Keep it visible by default only if it helps the team do one of these things faster:

- create a campaign
- review copy
- approve content
- review a core image asset
- export a handoff package

If it primarily helps with debugging, power-user inspection, or future automation, keep it in advanced mode.

## What Stays In The MVP

- brief creation
- generated campaign drafts
- copy review and manual edits
- approval / reject / request changes
- ownership and notes
- summary-level QA
- creative asset review at a practical level
- export package JSON
- downloadable handoff bundle ZIP

## What Gets Parked

- queue-heavy publishing operations in the default flow
- analytics-heavy review in the default flow
- deep instrumentation surfaces in the default flow
- metadata-heavy provider detail in the default flow
- advanced placement editing as a normal-first interaction

## Current Limitations

- advanced functionality still exists in the branch and increases code complexity even when hidden
- campaign detail remains large internally even after UI consolidation
- some placement-level detail is still visible inside handoff when a campaign is paid-heavy
- export and handoff remain stronger than live publishing as an MVP story

## Next Steps After Real Usage

Only after the team uses the MVP flow in practice should Handi decide whether to:

- keep advanced queue operations alive
- keep expanding placement nuance
- keep growing analytics and winner logic
- split repository-heavy modules further

The rule is simple:

- use the smaller system first
- observe what the team actually touches
- only then promote more advanced surfaces back into daily operation
