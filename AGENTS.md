---
codex:
  approval_mode: "auto" # "auto" = no pide confirmación
  auto_approve:
    - file_write # crear/editar/borrar archivos
    - run_command # ejecutar comandos de terminal
    - install_dependencies # npm/pnpm/yarn install
    - modify_config # editar .env, config, linters (sin exponer secretos)
  guardrails:
    max_files: 50 # tope de archivos por tarea
    max_runtime_minutes: 20 # tope de minutos por tarea
    disallowed: # SIEMPRE prohibido
      - "git push --force"
      - "rm -rf /"
      - "vercel env pull --environment=production"
      - "openssl rsautl -decrypt"
---

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
- Files: React components PascalCase.tsx; modules/utilities kebab-case.ts.
- ESLint: extends next/core-web-vitals and TS recommended; enforces import/order, no `any`, y variables sin uso deben iniciar con `_`.
- Formatting: Prettier (+ Tailwind plugin). Ejecuta `npm run lint` antes del PR.

## Testing Guidelines

- Framework: Playwright (tests/e2e/\*.spec.ts).
- Especificaciones enfocadas en tareas; selectores resilientes.
- Local: `npm run dev` en una terminal, luego `npm run test:e2e`.

## Commit & Pull Request Guidelines

- Commits: Convención corta (ej.: `feat:`, `fix:`, `chore(api):`).
- PRs: Descripción clara, issues vinculados, screenshots de UI, y checklist:
  - Corrí `npm run check` y `npm run build`.
  - Agregué/actualicé tests según aplique.
  - Ejemplos de API incluyen `-H "Content-Type: application/json; charset=utf-8"`.

## Security & Configuration

- Nunca commitees secretos; no expongas `SUPABASE_SERVICE_ROLE_KEY` en cliente.
- Preferir SSR con cookies de Supabase; RLS en DB y validar inputs en server con Zod.
- Evitar rutas duplicadas; endpoints en `app/api/*`.
- Fuente de verdad: `docs/Handi_Documento_Maestro_Unificado_FULL.md` y `docs/Estado_de_Implementacion_vs_DM_Handi_Webapp.md`.
