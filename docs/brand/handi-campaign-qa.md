# Handi Campaign QA

## Goal

The QA layer helps the internal team review campaigns faster.

It is meant to:

- surface likely quality issues early
- highlight risky copy before approval
- make review priority clearer
- keep the reasoning transparent and deterministic

It is not meant to:

- replace human review
- auto-approve campaigns
- act as legal review
- publish anything externally

## What Gets Analyzed

### Campaign level

Each campaign stores:

- `qa_status`
- `reviewer_priority`
- `overall_score`
- `summary`
- `warnings`
- `suggestions`
- `analyzed_at`
- `ready_for_review`

### Message level

Each active message variant stores:

- `qa_status`
- `reviewer_priority`
- `overall_score`
- `brand_fit_score`
- `clarity_score`
- `cta_score`
- `channel_fit_score`
- `risk_score`
- `warnings`
- `suggestions`
- `detected_issues`
- `analyzed_at`
- `ready_for_review`

## Main Checks

The first version uses explicit heuristics, not an LLM.

Current checks include:

- headline/body length outside expected channel range
- CTA missing
- CTA too generic or weak
- low actionability
- aggressive or hype-heavy tone
- risky or absolute claims
- forced spanglish
- vague value proposition
- missing service context
- weak audience alignment
- weak goal alignment
- weak channel fit
- thin or incomplete rationale
- message structure mismatch for email, push, or WhatsApp

## Scoring Logic

The scoring model is intentionally simple.

Message scoring:

- start `brand_fit_score` at `100`
- start `clarity_score` at `100`
- start `cta_score` at `100`
- start `channel_fit_score` at `100`
- start `risk_score` at `0`
- each detected issue subtracts from quality scores and/or adds to risk
- scores are clamped to `0..100`

Message `overall_score`:

- average of `brand_fit_score`, `clarity_score`, `cta_score`, `channel_fit_score`, and `(100 - risk_score)`

Campaign `overall_score`:

- average of active message `overall_score` values

## QA Status

`ready_for_review`

- overall quality looks solid
- no material warning pattern detected

`needs_attention`

- review is still possible, but one or more issues should probably be cleaned up first

`high_risk`

- the copy shows stronger editorial or brand risk and should be reviewed first

Current mapping:

- `high_risk` when `risk_score >= 60` or `overall_score < 60`
- `needs_attention` when `overall_score < 80` or `risk_score >= 25`
- otherwise `ready_for_review`

## Reviewer Priority

Priority helps triage the queue.

Current mapping:

- `urgent` when `risk_score >= 65` or `overall_score < 55`
- `high` when `risk_score >= 45` or `overall_score < 70`
- `medium` when `risk_score >= 25` or `overall_score < 82`
- otherwise `low`

Campaign priority takes the highest reviewer priority found in active variants.

## Ready For Review

`ready_for_review` is a convenience signal only.

It means:

- QA did not detect a major issue pattern
- the current copy should be easier for a human to approve

It does not mean:

- the campaign is approved
- no one needs to read it
- the copy is ready for external publication

## When QA Runs

QA runs automatically when:

- a campaign is generated
- a content draft is generated
- a message is edited manually
- a message is regenerated

QA can also be triggered manually from the admin detail page:

- `POST /api/admin/campaigns/[id]/reanalyze`

## How To Use QA In Review

Suggested workflow:

1. Check campaign `qa_status` and `overall_score` in `/admin/campaigns`.
2. Open high-risk or high-priority campaigns first.
3. Read campaign warnings and summary before reviewing variants.
4. Use per-variant warnings to focus edits or regeneration requests.
5. Keep human judgment above QA whenever nuance, legal caution, or brand interpretation matters.

## Current Limitations

- QA is heuristic, not semantic understanding
- it does not understand nuanced context the way a human reviewer does
- it can produce false positives on short-form copy
- it does not evaluate design or visual execution
- it does not evaluate legal compliance beyond simple risky-claim heuristics
