Revisión UI (CSS/Accesibilidad/Visual)

Local

- Lint estilos: `npm run lint`
- Snapshots (necesita app corriendo en :3000 o PREVIEW_URL): `npm run snap`
- Lighthouse: `npx lhci autorun`

CI

- Cada PR corre:
  - Lint de estilos (ESLint/Stylelint)
  - Lighthouse (perf, a11y, SEO)
  - Screenshots Playwright (390/768/1280)

Artefactos

- Ver en pestaña "Actions" → Job `ui-checks` → artefacto `snapshots`.

PREVIEW_URL

- Define `PREVIEW_URL` en GitHub → Settings → Secrets → Actions.
- Ejemplo: URL de Vercel Preview del PR.
- Si no se define, el workflow hace fallback a local (`next build && next start` en `http://localhost:3000`).

Rutas de revisión

- Script de snapshots: `scripts/snapshots.js`. Edita `ROUTES` por defecto o usa `ROUTES=",/otra" npm run snap`.
- Página: `/design-check`. Agrega más links en `app/design-check/page.tsx`.

Instalación inicial

- Requiere Node 20+ y navegadores Playwright.
- Instala browsers: `npx playwright install --with-deps`.

Notas

- `eslint-plugin-tailwindcss` se carga condicionalmente. En Tailwind v4 se desactiva por incompatibilidad temporal.
- Stylelint extiende `stylelint-config-standard` + `stylelint-config-tailwindcss`.
