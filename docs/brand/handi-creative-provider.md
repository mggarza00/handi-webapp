# Handi Creative Provider

## Goal

The creative pipeline can now use a real image-generation provider without moving visual review outside Handi.

The provider layer stays responsible only for generation.
Handi remains responsible for:

- brief construction
- provider selection
- fallback logic
- private storage
- version history
- admin review and approval

## Active Provider Flow

Handi currently supports two runtime modes for image generation:

- `mock`
  Deterministic PNG assets rendered locally for testing and internal validation.
- `image-provider`
  A provider abstraction that can run live through OpenAI Images and fall back to mock if configuration or generation fails.

## Current Live Backend

The `image-provider` abstraction currently uses OpenAI image generation under the hood when live config is present.

Relevant official references:

- OpenAI Images API reference: https://platform.openai.com/docs/api-reference/images/overview
- OpenAI image generation guide: https://platform.openai.com/docs/guides/images/image-generation
- GPT Image model docs: https://platform.openai.com/docs/models/gpt-image-1

## Env Vars

Minimum activation:

- `HANDI_CREATIVE_PROVIDER=image-provider`
- `OPENAI_API_KEY=...`

Optional overrides:

- `HANDI_CREATIVE_IMAGE_API_KEY`
- `HANDI_CREATIVE_IMAGE_MODEL`
- `HANDI_CREATIVE_IMAGE_QUALITY`
- `HANDI_CREATIVE_IMAGE_BACKGROUND`
- `HANDI_CREATIVE_IMAGE_MODERATION`
- `HANDI_CREATIVE_IMAGE_OUTPUT_FORMAT`

Behavior:

- if `HANDI_CREATIVE_IMAGE_API_KEY` exists, it is used first
- otherwise the pipeline reuses `OPENAI_API_KEY`
- if neither key exists, the provider falls back to mock

## Prompting

Prompt construction stays centralized in:

- `lib/creative/brief.ts`
- `lib/creative/prompts.ts`
- `lib/creative/brand-visual-guards.ts`

The live provider receives:

- brand direction
- audience
- goal
- channel
- target format
- service category
- brief summary
- rationale summary
- composition notes
- visual constraints
- text overlay guidance
- explicit variant direction or regeneration feedback

## Persistence Model

The live provider never remains the final host of the asset.

The flow is:

1. provider returns a generated image payload
2. Handi decodes or downloads the result
3. Handi uploads the final binary to private Supabase Storage
4. Handi persists the asset record and version record
5. admin previews it through a signed URL

This means Handi owns the persisted asset that enters review.

## Stored Metadata

Provider metadata can include:

- provider name
- generation mode
- model
- generated timestamp
- request id
- provider reference id
- provider error type
- prompt summary
- fallback reason
- output width and height
- output format
- quality
- response summary

The metadata is intentionally operational and safe.
Secrets and raw sensitive payloads are not stored.

## Fallback Rules

The creative pipeline falls back to mock when:

- provider config is missing
- the live API call fails
- the provider response is empty or unusable
- the live asset cannot be persisted cleanly and the repo can recover by retrying with mock

The fallback is explicit in persisted metadata:

- provider mode becomes `fallback`
- provider name becomes `mock`
- error type is classified as `configuration_error`, `provider_error`, `response_error`, `storage_error`, or `unknown_error`
- fallback reason is recorded

## Current Limitations

- OpenAI is the current live backend behind the generic `image-provider` abstraction
- no image editing endpoint is used yet; regeneration is still prompt-based
- no video support
- no external visual publishing
- no automatic multiformat adaptation beyond the current format mapping
- if Supabase Storage itself is unavailable, neither live nor mock assets can be persisted

## Natural Next Steps

- add provider-specific tuning for format and quality by channel
- support image edit flows using an existing approved asset as visual input
- add asset adaptation jobs for story, square, email hero, and landing hero variants
- connect approved visuals to publish/export payload assembly
