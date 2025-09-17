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

## Supabase local
- Instala Docker Desktop y asegúrate de que el daemon esté ejecutándose antes de usar los comandos de Supabase.
- Ejecuta `npx supabase start` en la raíz del repo para levantar los contenedores locales.
- Verifica el estado con `npx supabase status`; si ves *The system cannot find the file specified* o *Make sure you've run 'supabase start'!* significa que Docker Desktop no está activo.
- Cuando termines, detén los servicios con `npx supabase stop`.

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
  "name": "handi-webapp",
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

### Ejemplos de prompts

- Stripe: «Usa la herramienta `stripe.paymentLinks.create` para generar un enlace de pago de 1299 MXN para el plan Premium».
- PayPal: «Consulta con `paypal.list_invoices` los últimos 5 invoices pendientes».
- Playwright: «Con Playwright abre `https://handi-webapp-woad.vercel.app`, toma una captura y dime si el CTA principal es visible».

> Tip: si necesitas restringir dominios en Playwright MCP, añade `--allowed-origins` (ej. `http://localhost:3000;https://handi.mx`) a los argumentos.

Si alguna herramienta falta, abre la paleta (`Ctrl/Cmd+Shift+P`) y ejecuta `Agents: Reload MCP Servers`. Los prompts `STRIPE_SECRET_KEY` y `PAYPAL_BEARER` quedan guardados como entradas secretas, y `STRIPE_ACCOUNT` como entrada opcional; limpia o reemplaza sus valores desde `Settings → MCP Inputs` si necesitas regenerarlos.

