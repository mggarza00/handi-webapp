# Handi LLM Provider

## Goal

Provide one clean seam for live LLM generation without bypassing the internal editorial workflow.

Core rule:

- The provider generates.
- Admin reviews.
- Nothing skips `/admin/campaigns`.

## Files

- `lib/ai/provider.ts`
- `lib/ai/providers/mock.ts`
- `lib/ai/providers/openai.ts`
- `lib/ai/providers/shared.ts`

## Provider Selection

Use:

- `HANDI_AI_PROVIDER=mock`
- `HANDI_AI_PROVIDER=openai`

If `HANDI_AI_PROVIDER` is not set to `openai`, the system stays on the deterministic mock provider.

## Required Environment Variables

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Optional:

- `OPENAI_REASONING_MODEL`

Recommended local setup:

```env
HANDI_AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_REASONING_MODEL=
```

## Live vs Fallback Behavior

The OpenAI provider falls back to mock when:

- `OPENAI_API_KEY` is missing
- the OpenAI call fails
- the model response does not validate against the local Zod schema
- the mapped output fails final local validation

Fallback is explicit and persisted as metadata:

- `providerName`
- `generationMode`
- `model`
- `generatedAt`
- `fallbackReason`
- `requestId`
- `note`

## Structured Output Contract

The live provider generates a structured package with:

- `recommendedAngle`
- `rationaleSummary`
- `variants[]`

Each variant includes:

- `label`
- `headline`
- `body`
- `cta`
- `rationale`

Rationale is normalized into:

- `angle`
- `audienceIntent`
- `whyChannel`
- `whyCta`
- `note`
- `summary`

## Generation Flow

1. Admin submits a brief.
2. Campaign logic builds brand context and deterministic planning context.
3. Provider receives the channel prompt plus brand rules and brief data.
4. OpenAI returns structured output or the provider falls back to mock.
5. The output is validated locally.
6. Drafts, messages, versions, rationale, and provider metadata are persisted.
7. Admin reviews in `/admin/campaigns`.

## Regeneration Flow

Regeneration sends:

- previous content
- previous rationale
- feedback note
- audience
- goal
- channel
- CTA
- offer
- service category
- Handi brand context

The expected output is a new structured variant that explains what changed and why.

## Current Limits

- No external publishing
- No autonomous approval
- No scheduling
- No analytics feedback loop into prompting yet
- No multi-model routing beyond `OPENAI_MODEL` and optional `OPENAI_REASONING_MODEL`
