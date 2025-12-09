# Revisión UI Automatizada (loop offline)

Este flujo prepara artefactos (PNG + HTML) para que un agente externo proponga cambios de UI. No envía nada a OpenAI en este entorno; deja hooks listos.

## Configuración de targets

- Archivo: `scripts/ui-revision.targets.json`
- Campos por pantalla:
  - `id`: identificador único.
  - `path` o `url`: ruta a navegar.
  - `role`: `guest|client|professional|admin` (usa `/api/test-auth` para cookies dev).
  - `waitAfterMs` (opcional): tiempo de settle antes del screenshot.
  - `viewports` (opcional): anchuras específicas para el target.
  - `notes` / `successCriteria` (opcional): hints para el agente.
- Vista global: `viewports` por defecto (override con env `VIEWPORTS="430,1024"`).

## Orquestador

- Script: `tools/ui-revision.ts` (ejecuta Playwright, genera artefactos).
- Salida: `artifacts/ui-revision/<target>/iter-<n>/` con:
  - `*.png`: capturas por viewport.
  - `*.html`: DOM completo de la carga.
  - `meta.json`: consola (warnings/errors) y paths de los assets.

CLI (local):
- `npm run ui:revise` (todos los targets, 1 iteración, usa BASE_URL/PREVIEW_URL o localhost:3000).
- `npm run ui:revise -- --target=home-guest` (filtra un target).
- `npm run ui:revise -- --iterations=3` (loop configurable; sin modelo no aplica cambios).
- Flags: `--headed` para abrir navegador no headless; `VIEWPORTS` y `BASE_URL`/`PREVIEW_URL` como overrides (útil en CI apuntando a un preview ya levantado).

CI:
- Ejecuta el mismo comando (`npm run ui:revise`) en un job que ya tenga la app servida o un `BASE_URL` de preview. Si no hay servidor, el script no arranca Next.js.

## Extender con modelo

Puntos de extensión (comentados en `tools/ui-revision.ts`):
- Tras capturar cada target: enviar PNG/HTML al modelo y aplicar patches solo en UI.
- Tras cada iteración: decidir si seguir (hasta `--iterations`, default 1 aquí).

## Añadir una nueva pantalla

1. Edita `scripts/ui-revision.targets.json` y agrega un objeto con `id`, `path` y `role`.
2. Opcional: `waitAfterMs` si la pantalla anima/hidrata lento; `successCriteria` para notas.
3. Corre `npm run ui:revise -- --target=<id>` para generar artefactos.

## Limitaciones actuales
- No se llama a OpenAI ni se aplican parches automáticamente; el orquestador deja hooks listos.
- No se levanta el servidor Next.js: se asume que `BASE_URL`/`PREVIEW_URL` apunta a un entorno accesible o que la app ya corre en localhost:3000.
- Iteraciones: por defecto 1; puedes subirlas con `--iterations`, pero sin modelo no hay decisión automática de “suficiente”.
