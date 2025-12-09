AI Classifier: Request Autoclassification

Overview
- Users type title and description in `/requests/new`.
- Client debounces 800 ms on changes and POSTs to `/api/classify-request` with `{ title, description }`.
- Server combines a heuristic baseline with GPT (when `OPENAI_API_KEY` is set) to propose a best match and up to 3 alternatives.
- If `confidence >= 0.6` and user has not manually changed selections, the UI auto-applies category/subcategory. Otherwise, alternatives render as chips so the user can click to apply.

Endpoint: POST /api/classify-request
- Input: `{ title?: string, description?: string }`
- Output: `{ ok: true, best: { category_id, subcategory_id, category, subcategory, confidence, model? }, alternatives: Suggestion[] }`.
- response_format: Uses OpenAI Chat Completions with `response_format: { type: "json_object" }` to ensure strict JSON content.
- Taxonomy validation: The handler loads active taxonomy from Supabase (`categories_subcategories`) including `categories_subcategories_id` and validates any GPT IDs. If GPT returns names but no IDs, names are mapped to IDs. If Supabase is unavailable, a minimal deterministic fallback taxonomy is used for development.
- Rate-limit: Simple in-memory per‑IP rate limit `CLASSIFY_RATE_PER_MIN` (default 30/min).

UI Behavior
- Debounce: 800 ms (title/description changes).
- Auto-apply: If `best.confidence >= 0.6` and `manualOverride=false`, set `category`, `subcategory` and `subcategory_id`. We do not persist a separate `category_id` because the taxonomy currently defines IDs per (category, subcategory) row.
- Alternatives: Renders up to 3 chips; clicking a chip applies that selection and sets `manualOverride=true`.
- Manual edits: Selecting a category or subcategory in the form sets `manualOverride=true` and stops subsequent automatic overwrites.

Persistence
- On submit, the form includes optional AI fields in the payload:
  - `category_id: null` (reserved; taxonomy currently provides only subcategory row IDs)
  - `subcategory_id: string | null` (validated row ID when available)
  - `ai_confidence: number | null`
  - `ai_model: string | null`
  - `ai_overridden: boolean` (true if user changed the selection manually or clicked an alternative)
- The current backend may ignore these fields if the DB schema does not yet include them. They are sent for forward compatibility.

Telemetry
- Client fires `/api/telemetry` with event `requests.auto_classified` and props:
  - `confidence: number`
  - `overridden: boolean`
  - `alt_clicked: boolean`
  - (optionally) `category`, `subcategory` when applied automatically

Fallbacks & Thresholds
- If OpenAI is not configured or fails, the endpoint uses heuristic scoring on the active taxonomy to propose a best suggestion + alternatives.
- Auto-apply threshold is set at 0.6 to improve recall while still avoiding frequent misclassifications; users can override manually or via chips.

Local Testing Tips
- Ensure `.env.local` has Supabase admin creds to validate IDs:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- To enable GPT, add:
  - `OPENAI_API_KEY`
  - optionally `OPENAI_MODEL` (defaults to `gpt-4o-mini`)
- Rate limit can be tuned via `CLASSIFY_RATE_PER_MIN`.

