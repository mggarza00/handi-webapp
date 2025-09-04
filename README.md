# Handee Webapp

Next.js 14 (App Router) + Google Sheets (Service Account).

## Requisitos
- Node.js 18+
- NPM o PNPM
- Acceso a Google Sheet (Service Account con permiso Editor)

## Variables de entorno
Copia `.env.example` a `.env.local` y rellena:
- `PROJECT_ID`
- `CLIENT_EMAIL`
- `PRIVATE_KEY` (usar `\n` en una sola línea si el código hace `replace(/\\n/g, '\n')`)
- `SHEET_ID`

## Desarrollo local
```bash
npm install
npm run check        # typecheck + lint (opcional pero recomendado)
npm run dev          # http://localhost:3000

## Revisión automática de CSS/UI
- Ejecuta typecheck + lint + capturas responsivas + Lighthouse:
  - `npm run review:ui` (sirve en dev si no hay `BASE_URL`)
  - Variables opcionales: `BASE_URL` o `PREVIEW_URL` para apuntar a un entorno ya levantado
- Capturas: `snapshots/*`
- Reportes Lighthouse: `artifacts/lhci/*.html` (configurable en `lighthouserc.cjs`)

## E2E con Playwright (dev/CI)
- Ruta de **mock de rol** (solo dev/CI): `/api/test-auth/:role` con `role` en `guest|client|professional|admin`.
- La UI debe exponer testids en el header:
  - Invitado: `data-testid="btn-login"` y `data-testid="btn-apply"`
  - Autenticado: `data-testid="avatar"`
  - Cliente: `data-testid="nav-client"`
  - Profesional: `data-testid="nav-professional"`
  - Admin: `data-testid="nav-admin"`
- Ajusta los selectores en `tests/e2e/navbar-roles.spec.ts` si usas otros.
