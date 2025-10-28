# Handi Webapp

> Repositorio: https://github.com/mggarza00/homaid-webapp

Estado CI:

[![Design CI](https://github.com/mggarza00/homaid-webapp/actions/workflows/design-ci.yml/badge.svg)](https://github.com/mggarza00/homaid-webapp/actions/workflows/design-ci.yml)
[![Playwright E2E](https://github.com/mggarza00/homaid-webapp/actions/workflows/playwright.yml/badge.svg)](https://github.com/mggarza00/homaid-webapp/actions/workflows/playwright.yml)
[![Vercel (prod)](https://img.shields.io/github/deployments/mggarza00/homaid-webapp/production?label=vercel%20prod&logo=vercel)](https://github.com/mggarza00/homaid-webapp/deployments)
[![Vercel (preview)](https://img.shields.io/github/deployments/mggarza00/homaid-webapp/preview?label=vercel%20preview&logo=vercel)](https://github.com/mggarza00/homaid-webapp/deployments)

Deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mggarza00/homaid-webapp)

Preview:

https://homaid-webapp-woad.vercel.app

Next.js 14 (App Router) + Supabase + Google Sheets (Service Account).

## Admin MVP (/admin)

- Requisitos: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y (opcional) `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `ADMIN_EMAILS`.
- Migrar/seed:
  - `npm run db:migrate`
  - `npm run db:seed:admin`
- Dev: `npm run dev` y abre `/admin`.
- Más detalles: `docs/ADMIN_MVP.md`.

### Estados de Solicitud y Calendario del Pro

- Estados (UI → BD):
  - `active`/`pending` → Activa
  - `scheduled` → Agendada
  - `in_process` → En proceso
  - `completed`/`finished` → Finalizada
  - `canceled`/`cancelled` → Cancelada

- Stripe Webhook: al pagar, marca `scheduled`, oculta de Explore y upsert en `pro_calendar_events`.
- Calendario del pro (`/pro/calendar`): consume `GET /api/pro/calendar` con `revalidateTag('pro-calendar')` para refresco tras webhook y cambios de estado.
- `PATCH /api/requests/:id/status`: sincroniza `pro_calendar_events.status` y revalida `/pro/calendar`, `/requests/:id` y `/mensajes/:id`.

## Documentación

- Documento Maestro (actualizado con separación de profesionales): docs/homaid_Documento_Maestro_Unificado_FULL.md
- Trazabilidad de Tablas (fuente de verdad de flujos y buckets): docs/homaid_Documento_Maestro_Trazabilidad.md
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

### Web Push (VAPID)

- Claves VAPID (generar): `npx web-push generate-vapid-keys`
- Variables requeridas (server):
  - `WEB_PUSH_VAPID_PUBLIC_KEY`
  - `WEB_PUSH_VAPID_PRIVATE_KEY`
  - `WEB_PUSH_VAPID_SUBJECT=mailto:soporte@handi.mx` (corregido)
- Exposición al cliente: `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` (configurada en `next.config.mjs`).

Notas iOS: Web Push requiere iOS 16.4+ con Safari y “Añadir a pantalla de inicio”. Si el permiso está denegado, el botón muestra un tip para habilitarlo desde el candado de la barra de direcciones.

Endpoints canónicos para Web Push:
- Canonical: `/api/push/*` (`/api/push/subscribe`, `/api/push/send`)
- Compatibilidad: `/api/web-push/*` re-exporta a `/api/push/*`

## Handi Webapp · Arranque y Debug

### Next.js (recomendado)
- Desarrollo: `npm run dev` (VS Code: F5 → "Debug Next.js (npm run dev)")
- Build: `npm run build`
- Start: `npm run start`

### Deno (opcional)
- Script demo: `scripts/deno/hello.ts`
- Debug: F5 → "Debug Deno (scripts/deno/hello.ts)"
- Nota: En Deno 2 ya no existe `--unstable` global. Usa flags `--unstable-*` solo si ocupas APIs específicas.

## Supabase local
- Instala Docker Desktop y asegurate de que el daemon este ejecutandose antes de usar los comandos de supabase.
- Ejecuta `npx supabase start` en la raiz del repo para levantar los contenedores locales.
- Verifica el estado con `npx supabase status`; si ves `The system cannot find the file specified` o `Make sure you've run 'supabase start'!` significa que Docker Desktop no esta activo.
- Cuando termines, deten los servicios con `npx supabase stop`.

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

## MCP en VS Code (Stripe, PayPal, Playwright)

**Requisitos**

- VS Code ≥ 1.93 con Agent Mode habilitado (Copilot/Codex activo en la cuenta).
- Node.js 18+ disponible para `npx`.
- Acceso a Stripe (Restricted Key recomendada) y PayPal (token Bearer sandbox/producción).

1. Abre la carpeta del proyecto en VS Code y entra a Agent Mode (`View → Appearance → Agent Mode` o `Ctrl/Cmd+Shift+I`).
2. Cuando VS Code lo solicite, pega tu clave `STRIPE_SECRET_KEY` (idealmente una Restricted Key) en el prompt cifrado y opcionalmente tu `STRIPE_ACCOUNT` si trabajas con cuentas conectadas. Para PayPal, `npx mcp-remote` abrirá el login (sandbox por defecto) y pedirá un token **Bearer** para el prompt `PAYPAL_BEARER`.
3. Verifica que aparezcan las herramientas en `Tools`:
   - `stripe` (local vía `npx` con clave pedida en tiempo real).
   - `stripe-remote` (opcional, remoto con OAuth si lo habilitas en el panel de Agent Mode).
   - `paypal` (remoto con OAuth vía `mcp-remote`).
   - `playwright` (local vía `npx`, utiliza la versión más reciente del servidor Playwright).
4. Si prefieres ejecutar Stripe o PayPal totalmente vía variables de entorno, defínelas antes de abrir Agent Mode (ej. macOS/Linux):
   ```bash
   export STRIPE_SECRET_KEY=sk_test_xxx
   export STRIPE_ACCOUNT=acct_xxx          # opcional para cuentas conectadas
   export PAYPAL_ACCESS_TOKEN=access_token_from_paypal
   export PAYPAL_ENVIRONMENT=SANDBOX       # o PRODUCTION
   ```
   En Windows PowerShell usa `setx` o perfiles (`$env:VAR="valor"`).

Configuración en `.vscode/mcp.json` (Stripe/PayPal remotos y alternativa local):

```json
{
  "$schema": "vscode://schemas/mcp",
  "servers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "${input:STRIPE_SECRET_KEY}",
        "STRIPE_ACCOUNT": "${input:STRIPE_ACCOUNT}"
      }
    },
    "stripe-remote": {
      "type": "http",
      "url": "https://mcp.stripe.com"
    },
    "paypal": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.sandbox.paypal.com/http",
        "--header",
        "Authorization:Bearer ${input:PAYPAL_BEARER}"
      ]
    },
    "paypal-local": {
      "command": "npx",
      "args": ["--yes", "@paypal/mcp", "--tools=all"],
      "env": {
        "PAYPAL_ACCESS_TOKEN": "${env:PAYPAL_ACCESS_TOKEN}",
        "PAYPAL_ENVIRONMENT": "${env:PAYPAL_ENVIRONMENT}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Puedes habilitar o deshabilitar `stripe-remote` desde Agent Mode → Settings → MCP Servers. El prompt `STRIPE_SECRET_KEY` queda guardado como secreto en VS Code; elimina o reemplaza el valor desde `Settings → MCP Inputs` si necesitas regenerarlo.

Para actualizar la configuración o los secretos:

- Abre la paleta de comandos y ejecuta `MCP: Open Workspace Folder Configuration` para editar `.vscode/mcp.json` desde VS Code.
- También puedes abrir `.vscode/mcp.json` directamente y guardar los cambios. Al reiniciar o recargar el servidor, VS Code volverá a solicitar los `inputs` (`STRIPE_SECRET_KEY`, `STRIPE_ACCOUNT`, `PAYPAL_BEARER`).

### Gestión de servidores

- `MCP: Show Installed Servers` → verifica qué servidores están activos y su estado.
- `MCP: List Servers` → selecciona un servidor para reiniciarlo, detenerlo o abrir su salida (`Show Output`) y revisar logs en caso de errores.
- Cuando un servicio no responda, usa `Show Output` para capturar logs y documentar problemas en este README.

### Pruebas rápidas

- En Agent Mode abre `Tools` y confirma que aparezcan `stripe`, `stripe-remote` (si está habilitado), `paypal` y `playwright`.
- Ejecuta `stripe.create_customer` (usa el servidor remoto OAuth o el local con la key ingresada) para validar credenciales.
- Ejecuta `paypal.list_invoices` con un `PAYPAL_BEARER` sandbox válido.
- Ejecuta `playwright.browser_navigate` con `{"url":"http://localhost:3000"}` y luego `playwright.browser_snapshot` para confirmar navegación y capturas.

### Seguridad

- No hardcodees llaves en el repositorio; usa los prompts (`inputs`) o variables de entorno locales.
- Los archivos sensibles `.vscode/mcp.json.local` y la carpeta `.mcp-auth/` (tokens OAuth) están ignorados en git.

### Dev Container (opcional)

Si trabajas con Dev Containers, asegúrate de montar la carpeta del proyecto (para que `.vscode/mcp.json` quede accesible) y agrega el siguiente bloque en tu `.devcontainer/devcontainer.json`:

```jsonc
{
  "name": "homaid-webapp",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",
  "customizations": {
    "vscode": {
      "extensions": [
        "github.copilot",
        "ms-playwright.playwright",
        "anthropic.mcp"
      ],
      "mcp": {
        "$schema": "vscode://schemas/mcp",
        "servers": {
          "stripe": {
            "command": "npx",
            "args": ["-y", "@stripe/mcp", "--tools=all"],
            "env": {
              "STRIPE_SECRET_KEY": "${input:STRIPE_SECRET_KEY}",
              "STRIPE_ACCOUNT": "${input:STRIPE_ACCOUNT}"
            }
          },
          "stripe-remote": {
            "type": "http",
            "url": "https://mcp.stripe.com"
          },
          "paypal": {
            "command": "npx",
            "args": [
              "-y",
              "mcp-remote",
              "https://mcp.sandbox.paypal.com/http",
              "--header",
              "Authorization:Bearer ${input:PAYPAL_BEARER}"
            ]
          },
          "playwright": {
            "command": "npx",
            "args": ["-y", "@playwright/mcp@latest"]
          }
        },
        "inputs": [
          {
            "id": "STRIPE_SECRET_KEY",
            "type": "promptString",
            "description": "Stripe Secret Key (usa una Restricted Key en lo posible)",
            "password": true
          },
          {
            "id": "STRIPE_ACCOUNT",
            "type": "promptString",
            "description": "Stripe connected account (acct_...) opcional para MCP local"
          },
          {
            "id": "PAYPAL_BEARER",
            "type": "promptString",
            "description": "PayPal Bearer (client credentials o access token para MCP remoto sandbox/producción)",
            "password": true
          }
        ]
      }
    }
  }
}
```

El bloque anterior replica la configuración local dentro del contenedor; ajusta la imagen base o extensiones según tus necesidades.

### Validación en VS Code

- Ejecuta `MCP: Show Installed Servers` y verifica que Stripe, PayPal y Playwright aparezcan en la lista.
- Si alguno falla, abre `MCP: List Servers`, selecciona el servidor y usa `Show Output` para revisar los logs. Copia cualquier traza relevante en la sección de troubleshooting al documentar incidentes.
- Ajusta credenciales desde `MCP: Open Workspace Folder Configuration` (edita `.vscode/mcp.json`) si alguna conexión falla y vuelve a cargar los servidores.

### Ejemplos de prompts

- Stripe: «Usa la herramienta `stripe.paymentLinks.create` para generar un enlace de pago de 1299 MXN para el plan Premium».
- PayPal: «Consulta con `paypal.list_invoices` los últimos 5 invoices pendientes».
- Playwright: «Con Playwright abre `https://homaid-webapp-woad.vercel.app`, toma una captura y dime si el CTA principal es visible».

> Tip: si necesitas restringir dominios en Playwright MCP, añade `--allowed-origins` (ej. `http://localhost:3000;https://homaid.mx`) a los argumentos.

Si alguna herramienta falta, abre la paleta (`Ctrl/Cmd+Shift+P`) y ejecuta `Agents: Reload MCP Servers`. Los prompts `STRIPE_SECRET_KEY` y `PAYPAL_BEARER` quedan guardados como entradas secretas, y `STRIPE_ACCOUNT` como entrada opcional; limpia o reemplaza sus valores desde `Settings → MCP Inputs` si necesitas regenerarlos.
# Handi Webapp
## Admin MVP · Scripts

- `pnpm dev` / `npm run dev`: inicia Next.js en dev.
- `pnpm build` / `npm run build`: build de producción.
- `pnpm start` / `npm start`: sirve build.
- `pnpm db:migrate` / `npm run db:migrate`: aplica migraciones (Supabase CLI).
- `pnpm db:seed` / `npm run db:seed`: ejecuta `db/seed/seed.sql` (básico).
- `pnpm db:seed:large` / `npm run db:seed:large`: seed grande para demo (webhooks/pagos/jobs).
- `pnpm lint` / `npm run lint`: lint de JS/TS + CSS.
- `pnpm format` / `npm run format`: Prettier.
- `pnpm test` / `npm run test`: E2E (Playwright) base.
- `pnpm check:admin`: typecheck + lint scope admin.

## Requisitos

- Node 18+
- Supabase CLI vinculado al proyecto.
- Variables en `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - `ADMIN_EMAILS` (opcional, correos con acceso admin)

## Instalación

```bash
pnpm i
# (opcional) Inicializar shadcn/ui si partes desde cero
pnpm dlx shadcn-ui@latest init || true
pnpm dev
```

## Configurar Supabase + Migraciones + Seed

```bash
# Vincula el proyecto (una sola vez)
supabase link

# Aplica migraciones
pnpm db:migrate

# Seed básico o grande
pnpm db:seed
# o
pnpm db:seed:large
```

## Usuarios de prueba

- Crea usuarios con email/password en Supabase Auth y asigna roles en `profiles.role`:
  - `owner`, `admin`, `ops`, `finance`, `support`, `reviewer` → acceso a /admin.
- Alternativa dev/CI: `GET /api/test-auth/admin` setea cookie `handi_role=admin` (bypass middleware en no-producción).

## Configuración (Comisiones/IVA)

- Ve a `/admin/settings` y guarda (usa `PUT /api/config`).
- Ver efecto en UI: KPIs del Dashboard y flujos de pagos (mock) reflejan los cambios; se registra en `audit_log`.

## Criterios de aceptación (MVP)

- Acceso a `/admin` redirige a `/auth/sign-in` si no hay sesión (o usa cookie dev `handi_role`).
- Roles permitidos ven sidebar/topbar y páginas del MVP.
- Dashboard: 4+ KPI cards, 1 gráfica de líneas (solicitudes/pagos 30 días), 1 sección de pendientes (KYC/Disputas).
- Solicitudes: lista con filtros y paginación; detalle muestra datos coherentes (base preparada; ver `/api/requests/[id]`).
- Profesionales: tabs por KYC (pendientes/aprobados/observados) y acciones de Aprobar/Rechazar/Pedir info (base en endpoints admin; UI en progreso).
- Pagos: lista read-only con estados y totales; export CSV.
- Configuración: guarda comisiones/IVA en `config` y registra en `audit_log`.
- Sistema: muestra `webhooks_log` y `audit_log` con filtros básicos (endpoints listos).
- Seed de datos permite navegar sin errores.

## Entregables

- Código y rutas del MVP (/admin + APIs), componentes admin (sidebar/topbar/KPIs/tabla reutilizable).
- Migraciones SQL en `supabase/migrations/` y seed en `supabase/seed_admin_large.sql` / `db/seed/seed.sql`.
- README con instrucciones para correr local y validar el MVP.
