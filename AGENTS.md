# Repository Guidelines

## Project Structure & Module Organization
- App Router: `app/` (pages, layouts, `app/api/*/route.ts`).
- UI: `components/`, `components/ui/`, styles via Tailwind + shadcn/ui.
- Shared code: `lib/`, types in `types/`.
- Data/ORM: `prisma/` (schemas, client), `supabase/` (config, migrations as needed).
- Assets: `public/`. Docs: `docs/`. E2E tests: `tests/e2e/`.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js 14 dev server.
- `npm run build`: Production build; use for CI validation.
- `npm start`: Run built app.
- `npm run typecheck`: TypeScript check (no emit).
- `npm run lint`: ESLint (Next.js + TS rules).
- `npm run check`: Typecheck + lint.
- `npm run test:e2e`: Playwright headless E2E. `:ui` for inspector.

## Coding Style & Naming Conventions
- Language: TypeScript, 2-space indent. Prefer named exports.
- Files: React components `PascalCase.tsx`; modules/utilities `kebab-case.ts`.
- ESLint: extends `next/core-web-vitals` and TS recommended; enforces `import/order`, no `any`, and unused vars must be prefixed with `_`.
- Formatting: Prettier (+ Tailwind plugin). Run `npm run lint` before PR.

## Testing Guidelines
- Framework: Playwright (`tests/e2e/*.spec.ts`).
- Write task-focused specs; keep selectors resilient.
- Local run: `npm run dev` in one terminal, then `npm run test:e2e`.

## Commit & Pull Request Guidelines
- Commits: Conventional short prefixes (e.g., `feat:`, `fix:`, `chore(api):`).
- PRs: Clear description, linked issues, screenshots for UI, and checklist:
  - Ran `npm run check` and `npm run build`.
  - Added/updated tests as needed.
  - API examples include `-H "Content-Type: application/json; charset=utf-8"`.

## Security & Configuration
- Never commit secrets; do not expose Supabase SERVICE_ROLE in the client.
- Prefer SSR with Supabase cookies; enforce RLS at the DB and validate inputs on the server with Zod.
- Avoid duplicated routes; App Router endpoints live under `app/api/*`.
- Source of truth: `docs/Handee_Documento_Maestro_Unificado_FULL.md` and `docs/Estado_de_Implementacion_vs_DM_Handee_Webapp.md`.
