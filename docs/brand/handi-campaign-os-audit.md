# Handi Campaign OS Audit

## Executive Summary

The current branch contains a serious amount of product and technical work, but it no longer behaves like a focused MVP.

The system is strongest in one clear area:

- internal campaign briefing, copy generation, review, editing, approval, and traceability

The system becomes much weaker as it expands outward into:

- advanced QA surfacing
- publish scheduling and queue operations
- runtime instrumentation health
- placement-level paid handoff
- draft exporters
- visual readiness and multi-format creative coverage

Those areas are not useless, but they now create more surface area than the team can comfortably operate day to day.

The practical recommendation is:

- keep the editorial core
- keep a lighter creative workflow
- keep export-oriented handoff
- pause deeper publish automation
- hide most advanced analytics / runtime health / paid ops detail from default admin usage

The goal is not to delete work immediately. The goal is to stop treating every implemented subsystem as part of the active product surface.

## Audit Criteria

Each capability was evaluated against:

- operational value in the next real usage cycle
- technical complexity and coupling
- UX cost / cognitive load
- explainability to internal users
- dependency pressure on other modules
- maintenance risk

Status meanings:

- `KEEP_NOW`: belongs in the operational MVP
- `KEEP_LATER`: useful, but not essential for the MVP surface
- `PAUSE`: stop expanding for now; keep dormant
- `REMOVE_OR_HIDE`: do not remove data/models yet, but hide or deactivate from default admin usage

## Complexity Signals

The system has grown into several large operational files:

- `app/admin/campaigns/[id]/page.tsx`: ~3938 lines
- `app/admin/campaigns/page.tsx`: ~633 lines
- `app/admin/campaigns/analytics/page.tsx`: ~790 lines
- `app/admin/creative-assets/[id]/page.tsx`: ~934 lines
- `lib/campaigns/repository.ts`: ~3556 lines
- `lib/campaigns/publish-queue.ts`: ~1180 lines
- `lib/creative/export-bundles.ts`: ~878 lines
- `lib/analytics/runtime-health.ts`: ~436 lines

This does not mean the work is bad. It does mean the product surface is larger than the current operating need.

## Domain Audit

### 1. Editorial / Copy

Capabilities that exist:

- brief creation
- campaign generation
- persisted drafts and variants
- edit / regenerate
- approve / reject / request changes
- ownership
- checklist
- internal notes
- activity feed
- version history

Coupling:

- tightly coupled to repository, QA, exports, and admin detail
- still the cleanest end-to-end story in the system

Maturity:

- high

Usability today:

- medium to high after the recent UX consolidation

Criticality for MVP:

- very high

Recommendation:

- `KEEP_NOW`

Why:

- this is the core reason the system exists
- it is understandable to operators
- it produces direct value without requiring external platform complexity

### 2. Campaign QA / Scoring / Guardrails

Capabilities that exist:

- deterministic QA
- campaign-level and variant-level warnings
- scores
- reviewer priority
- suggestions
- ready-for-review signals

Coupling:

- coupled to generation, admin detail, decision support, and visual review language

Maturity:

- medium

Usability today:

- medium when surfaced lightly
- low when every score and warning is always visible

Criticality for MVP:

- medium

Recommendation:

- `KEEP_NOW`, but only as a lightweight review aid

Why:

- QA is useful for prioritization
- it becomes harmful when treated as a full product within the product

Operational rule for MVP:

- keep summary-level QA visible
- keep detailed guidance hidden behind expanders or advanced mode

### 3. Core Creative Workflow

Capabilities that exist:

- visual brief generation
- image provider abstraction
- live image provider + mock fallback
- storage-backed assets
- approvals
- versions
- previews

Coupling:

- tightly coupled to campaign detail, export packages, placement readiness, and storage

Maturity:

- medium

Usability today:

- medium

Criticality for MVP:

- medium to high if the team needs static campaign images now

Recommendation:

- `KEEP_NOW`, but scoped to:
  - master asset generation
  - review / approval
  - very limited derivative support

Why:

- visual assets inside the same editorial workflow are strategically valuable
- the workflow already exists and is coherent enough

### 4. Multi-format Adaptation / Derivatives

Capabilities that exist:

- format presets
- derivative generation
- adaptation metadata
- derivative review
- parent/master relations

Coupling:

- strongly coupled to creative readiness and paid handoff

Maturity:

- medium

Usability today:

- medium for power users
- low for an MVP operator who just wants a campaign ready

Criticality for MVP:

- low to medium

Recommendation:

- `KEEP_LATER`

Why:

- useful, but not essential for the first usable Campaign OS
- should remain available in advanced mode, not as a default concern

### 5. Publish / Queue / Scheduling / Retry

Capabilities that exist:

- ready-to-publish state
- publish jobs
- queue status
- schedule / unschedule / run now / run due
- retry policy
- throttling / concurrency hardening
- cron-compatible trigger
- email live
- push semi-live
- export-only channels

Coupling:

- very coupled to campaign status, selected variants, analytics, callbacks, and queue health UI

Maturity:

- medium technically
- low to medium as a product workflow

Usability today:

- low for most internal users

Criticality for MVP:

- low

Recommendation:

- `PAUSE`

Why:

- the queue is serious engineering, but it is not the clearest path to immediate product value
- it adds a lot of operational vocabulary
- it competes with the much clearer export-only handoff story

Practical MVP position:

- keep publish state and history in the data model
- stop expanding scheduling/throttling/retry behavior
- keep queue pages and controls in advanced mode only

### 6. Paid Handoff / Placement-aware Export

Capabilities that exist:

- placement taxonomy
- placement-aware asset resolution
- placement copy inheritance / override
- placement-level readiness
- paid handoff manifests
- ZIP bundles
- paid draft exporters for Meta and Google

Coupling:

- heavily coupled to creative bundles, placement copy, readiness, and export packages

Maturity:

- medium

Usability today:

- medium for specialists
- low for broad internal usage

Criticality for MVP:

- medium if the immediate goal is manual paid ops handoff
- low if the immediate goal is only internal editorial control

Recommendation:

- `KEEP_LATER` for placement-aware detail
- `KEEP_NOW` only for simple export packages

Why:

- generic export handoff is useful
- placement-level paid ops precision is valuable, but too large for the default MVP surface

### 7. Analytics / Recommendations / Winners

Capabilities that exist:

- internal performance metrics
- event ingestion
- campaign analytics dashboard
- trend comparison
- sufficient-data flags
- deterministic recommendations
- winner selection

Coupling:

- tied to publish jobs, callbacks, review, and variant logic

Maturity:

- medium technically

Usability today:

- low to medium

Criticality for MVP:

- low

Recommendation:

- `KEEP_LATER`

Why:

- useful after campaigns are running repeatedly
- not essential to prove the editorial product itself
- winner logic is especially premature when most channels remain export-only or only partially instrumented

### 8. GA4 / Clarity / Runtime Instrumentation Health

Capabilities that exist:

- browser-side GA4
- browser-side Clarity
- server-confirmed GA4 events
- tracking contracts
- CTA/url builders
- static instrumentation audit
- runtime instrumentation health

Coupling:

- coupled to product surfaces and attribution contracts, but less coupled to day-to-day Campaign OS editing

Maturity:

- medium to high technically

Usability today:

- low for marketers/editors inside the Campaign OS
- useful mostly for engineering and growth debugging

Criticality for MVP:

- low for the Campaign OS product surface

Recommendation:

- `PAUSE` for expansion
- `REMOVE_OR_HIDE` from the default Campaign OS admin surface

Why:

- this work complements the product, but it is not the Campaign OS product itself
- runtime instrumentation health is especially valuable for engineering, not for the default campaign operator

### 9. Admin UX / Operational Surfaces

Capabilities that exist:

- campaigns list
- campaign detail
- brief page
- analytics page
- queue page
- creative asset index/detail
- instrumentation page

Coupling:

- these pages are the visible expression of all other domains

Maturity:

- uneven

Usability today:

- medium after the latest UX pass
- still too concept-heavy

Criticality for MVP:

- very high

Recommendation:

- `KEEP_NOW`, but aggressively simplified

Why:

- the main product problem is not “missing features”
- the main product problem is that too many features are equally visible

## Capability Classification

### KEEP_NOW

- campaign brief creation
- campaign draft generation
- message variants
- edit / regenerate copy
- approval workflow
- ownership
- checklist
- internal notes
- activity feed
- summary-level QA
- campaign export package
- core creative master asset workflow
- basic admin list and detail

### KEEP_LATER

- derivative / multi-format creative adaptation
- placement-aware copy as an advanced capability
- placement-aware creative resolution
- paid handoff detail by placement
- paid draft exporters for Meta / Google
- analytics dashboard
- recommendations
- winner selection

### PAUSE

- publish queue expansion
- scheduling sophistication
- retry/throttling/concurrency hardening expansion
- deeper QA sophistication
- analytics instrumentation expansion
- runtime instrumentation health expansion
- cross-surface attribution expansion

### REMOVE_OR_HIDE

- queue-heavy controls from default campaign detail
- analytics-heavy tabs from default campaign detail
- creative deep metadata from default review flow
- instrumentation audit from normal Campaign OS navigation
- placement-level paid ops detail from the default happy path

## Proposed Real MVP

The MVP should answer one question well:

Can Handi create, review, approve, lightly refine, and hand off campaigns with clear copy and optional approved visuals from one internal admin workflow?

### MVP Screens

- `/admin/campaigns`
  - queue-focused list
  - search, status filters, owner filter
  - fast prioritization
- `/admin/campaigns/new`
  - create brief
- `/admin/campaigns/[id]`
  - `Overview`
  - `Copy`
  - `Export / Handoff`
  - optional `Creativos` in advanced mode
- `/admin/creative-assets`
  - advanced mode only

### MVP Workflows

1. Create brief
2. Generate campaign copy
3. Review and edit variants
4. Approve or request changes
5. Optionally create/review one or more visual assets
6. Export a usable package for manual ops handoff

### MVP Central Entities

- campaign draft
- campaign message
- campaign message version
- campaign feedback
- campaign internal note
- creative asset job
- creative asset

### What Leaves The Day-to-Day MVP Surface

- queue operations
- publish scheduling
- throttling / retries
- winner selection
- runtime instrumentation health
- placement-level paid detail by default
- deep QA and provider metadata by default

## Technical Simplification Proposal

### 1. Introduce soft UI modes

Use a very small admin-mode concept:

- `basic`
- `advanced`

Basic mode should be default.

Advanced mode should expose:

- creative deep workflow
- analytics tabs
- activity depth
- queue-related surfaces

### 2. Keep dormant models, reduce default rendering

Do not delete tables yet.

Instead:

- keep queue and publish-job models alive
- keep placement detail models alive
- keep analytics models alive
- stop rendering them as default admin concerns

### 3. Reduce repository pressure later

`lib/campaigns/repository.ts` is too large to remain the long-term single access layer.

After the MVP recut, split into:

- `campaign-drafts`
- `campaign-messages`
- `campaign-feedback`
- `campaign-publish`
- `campaign-analytics`

This is not the first consolidation step, but it should be a planned one.

### 4. Treat paid detail as an export specialization, not as the main product

Keep:

- generic export package
- ZIP handoff bundle

Hide by default:

- placement-level trafficking nuance
- platform-specific draft details

### 5. Freeze queue sophistication

The queue is one of the biggest complexity multipliers.

Recommendation:

- do not remove it yet
- stop expanding it
- keep it in advanced mode only

## Feature Flag / Soft Disable Strategy

Use a very small strategy, not a full flag framework.

### Proposed flags

- `CAMPAIGN_OS_ADMIN_MODE=basic|advanced`
  - default `basic`
  - controls default admin exposure

Optional later:

- `CAMPAIGN_OS_ENABLE_ANALYTICS_UI=1`
- `CAMPAIGN_OS_ENABLE_QUEUE_UI=1`
- `CAMPAIGN_OS_ENABLE_PAID_ADVANCED_UI=1`

But only add these if basic/advanced mode stops being enough.

## Admin UX Recommendation

### Visible in default MVP mode

- campaign list
- brief creation
- overview tab
- copy tab
- export / handoff tab

### Advanced mode only

- creatives deep tab
- analytics tab
- activity-heavy inspection
- queue operations
- instrumentation audit
- placement-level paid nuance when not needed for the immediate task

### Metadata that should stay hidden by default

- provider request IDs
- fallback notes unless there is a problem
- detailed QA issue lists
- version diffs unless explicitly requested
- queue operational internals
- runtime instrumentation health internals

## First Soft Simplification Applied

This audit phase also introduces a reversible simplification:

- a small Campaign OS admin mode
- default `basic` mode
- `advanced` mode available explicitly

Basic mode emphasizes:

- overview
- copy
- export / handoff

Advanced mode reveals:

- creatives
- analytics
- activity-heavy surfaces
- advanced links from the list and detail views

This keeps the existing work intact while reducing default exposure.

## Recommended Consolidation Steps

1. Freeze feature expansion outside the editorial core.
2. Adopt `basic` mode as the default operating mode.
3. Keep only `Overview`, `Copy`, and `Export / Handoff` as the default campaign detail experience.
4. Move queue, analytics, and instrumentation deeper into advanced mode.
5. Keep core creative generation, but treat derivatives and placement nuance as optional.
6. Stop expanding publish queue sophistication until the export-first workflow proves real usage.
7. Re-evaluate whether internal analytics and winner selection are truly being used before investing further.
8. Split the repository layer only after the MVP surface is clearly reduced.

## Risks And Tradeoffs

### If we keep everything equally visible

- the system remains impressive but hard to operate
- onboarding cost stays high
- product truth becomes fuzzy
- every new feature increases cognitive debt

### If we simplify too aggressively

- some power-user workflows become less discoverable
- advanced work may require explicit mode switches
- some previously celebrated sophistication becomes dormant

### Why the tradeoff is still worth it

- the current problem is not lack of capability
- the current problem is that too many capabilities pretend to be first-class at once

For the next stage, Handi needs a product that is easier to explain, easier to operate, and easier to maintain.
