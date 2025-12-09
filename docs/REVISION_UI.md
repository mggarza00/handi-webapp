Revision UI (CSS/Accesibilidad/Visual)

Local

- Lint estilos: `npm run lint`.
- Snapshots con Playwright (requiere app corriendo en :3000 o PREVIEW_URL/BASE_URL): `npm run snap`.
- Lighthouse: `npx lhci autorun`.
- Targets de snapshots: `scripts/ui-review.targets.json` (rutas, roles y viewports). Puedes sobrescribir con `ROUTES`, `VIEWPORTS`, `BASE_URL`/`PREVIEW_URL`.

CI

- Cada PR corre:
  - Lint de estilos (ESLint/Stylelint).
  - Lighthouse (perf, a11y, SEO).
  - Screenshots Playwright (390/768/1280 por defecto, se ajusta con `VIEWPORTS`).

Artefactos

- `snapshots/*.png` y `snapshots/ui-review.json`.
- Actions → Job `ui-checks` → artefacto `snapshots`.

Config rapida

- `PREVIEW_URL`/`BASE_URL`: URL del entorno ya desplegado (si no, usa localhost).
- `ROUTES="..."`: lista separada por comas para forzar rutas guest en snapshots.
- `VIEWPORTS="430,1024,1440"`: anchuras custom.
- `SNAPSHOT_STRICT=true`: marca error si alguna captura falla.

Rutas por defecto

- Home (guest), `/design-check` (guest), `/requests` y `/mensajes` (client), `/pro` (professional), `/admin` (admin). Agrega links recordatorios en `app/design-check/page.tsx` si los necesitas.

Instalacion inicial

- Requiere Node 20+ y navegadores Playwright.
- Instala browsers: `npx playwright install --with-deps`.

Notas

- `eslint-plugin-tailwindcss` se carga condicionalmente. En Tailwind v4 se desactiva por incompatibilidad temporal.
- Stylelint extiende `stylelint-config-standard` + `stylelint-config-tailwindcss`.
