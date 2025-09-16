# Handi Webapp

> Repositorio: https://github.com/mggarza00/handi-webapp

Estado CI:

[![Design CI](https://github.com/mggarza00/handi-webapp/actions/workflows/design-ci.yml/badge.svg)](https://github.com/mggarza00/handi-webapp/actions/workflows/design-ci.yml)
[![Playwright E2E](https://github.com/mggarza00/handi-webapp/actions/workflows/playwright.yml/badge.svg)](https://github.com/mggarza00/handi-webapp/actions/workflows/playwright.yml)
[![Vercel (prod)](https://img.shields.io/github/deployments/mggarza00/handi-webapp/production?label=vercel%20prod&logo=vercel)](https://github.com/mggarza00/handi-webapp/deployments)
[![Vercel (preview)](https://img.shields.io/github/deployments/mggarza00/handi-webapp/preview?label=vercel%20preview&logo=vercel)](https://github.com/mggarza00/handi-webapp/deployments)

Deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mggarza00/handi-webapp)

Preview:

https://handi-webapp-woad.vercel.app

Next.js 14 (App Router) + Supabase + Google Sheets (Service Account).

## Documentación

- Documento Maestro (actualizado con separación de profesionales): docs/Handi_Documento_Maestro_Unificado_FULL.md
- Trazabilidad de Tablas (fuente de verdad de flujos y buckets): docs/Handi_Documento_Maestro_Trazabilidad.md
- Migraciones SQL: supabase/migrations

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

````bash
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
   - Invitado: `data-testid="btn-login"`
  - Autenticado: `data-testid="avatar"`
  - Cliente: `data-testid="nav-client"`
  - Profesional: `data-testid="nav-professional"`
  - Admin: `data-testid="nav-admin"`
- Ajusta los selectores en `tests/e2e/navbar-roles.spec.ts` si usas otros.

## Subida de Fotos de Solicitudes (requests-photos)

- Componente: `components/PhotoUploader.tsx`
  - Acepta: JPG/PNG/WEBP/HEIC
  - Compresión cliente: lado más largo 1080px, calidad 0.8 (JPEG)
  - Thumbnail: 200px lado más largo
  - Máx. 6 archivos por lote; post-comp máx. 10MB c/archivo
  - Manejo de EXIF/orientación (via compresor)
  - UI con progreso + toasts (usa `sonner`, Toaster en `app/layout.tsx`)
  - Sube a Supabase Storage bucket `requests-photos` bajo `request_id/filename`
  - Guarda metadatos en `public.request_photos` y retorna URLs firmadas (1h)

- API:
  - `GET /api/photos/signed-url?path=...&expires=3600`: URL firmada de Storage
  - `POST /api/photos/metadata`: inserta metadatos y devuelve URLs firmadas

- SQL (Supabase): `supabase/sql/request_photos.sql`
  - Crea bucket privado `requests-photos`, tabla `public.request_photos`, índices y RLS
  - Políticas: dueño de la solicitud puede insertar; dueño o asignado puede leer
  - Storage policies: sólo permite `request_id/*`

- Configuración requerida:
  - Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Instalar dependencias: `npm i browser-image-compression` (opcional `npm i heic2any` para HEIC)
  - Aplicar SQL en el proyecto de Supabase: abre y ejecuta `supabase/sql/request_photos.sql`

- Uso rápido:
  ```tsx
  import PhotoUploader from "@/components/PhotoUploader";
  // Dentro de una página de solicitud
  <PhotoUploader requestId={request.id} onComplete={(items) => { /* refrescar vista */ }} />
````

Notas:

- Si deseas estandarizar post-procesado (p.ej. reencode server-side), se puede agregar una Edge Function posterior.
## Chat contextual (V1)

Endpoints (App Router):

- `POST /api/chat/start` → body `{ requestId, proId }`. Crea/retorna conversación para (request, customer, pro).
- `POST /api/chat/send` → body `{ conversationId, body }`. Inserta mensaje y actualiza `conversations.last_message_at`.
- `GET /api/chat/history?conversationId=...&limit=50&before=ISO` → lista mensajes (normaliza `body` con fallback a `text`).

Componentes UI (components/chat/):

- `ChatPanel` (prop `mode="panel"|"page"`) → usa `MessageList` + `MessageInput` y Realtime.
- `ConversationList` → para `/messages`.
- `MessageList`, `MessageInput` → reutilizables.

Integración:

- En `/requests/[id]` (Prospects), el botón "Enviar mensaje" llama a `POST /api/chat/start` y abre `ChatPanel` con la `conversationId` retornada.
- Header: botón Mensajes apunta a `/messages`.

SQL (Supabase): `supabase/migrations/20250908_chat_conversations.sql` o copia en `supabase/sql/chat_conversations.sql`.

Pruebas manuales:

1. Como cliente: `/requests/[id]` → "Enviar mensaje" a un pro → se abre panel → enviar y ver recepción en otra sesión (pro) por Realtime.
2. Cerrar/abrir panel, historial persiste vía `/api/chat/history`.
3. Ir a `/messages` y abrir `/messages/[conversationId]`.
4. Verificación RLS: usuarios no participantes reciben 403 en API.
