# Estado de Implementación vs Documento Maestro – Handee Webapp
**Última actualización:** 2025-09-02 (America/Monterrey)

## Resumen ejecutivo
- 🟨 Lint/TS: hay pendientes menores existentes (import/order en `components/UpdateEmailForm.tsx` y `no-explicit-any` en `app/api/test-seed/route.ts`).
- ⏳ Build: no ejecutado en esta revisión (previo OK).
- ✅ Auth SSR (Supabase) consolidado en `lib/_supabase-server.ts` (cookies, `getUserOrThrow`).
- ✅ Convención de headers: respuestas JSON con `application/json; charset=utf-8`.
- ✅ API alineada al DM: requests, applications, agreements, professionals, prospects, messages, stripe (según revisión previa).
- ✅ UI: ajustes al header para ancho/posición según DM UX; panel de Prospectos y Chat con candado (previo).
- ✅ Notificaciones: plantillas HTML y deep links (Resend-like; no-op sin claves).
- ✅ Calidad: Husky + Lint/TS; script de migraciones y archivo REST E2E.

---

## Plan por Fases (DM) — Estado y brechas

### Fase 1 — Consolidación básica (23 semanas)
- Onboarding profesionales in‑app:
  - Implementado: UI `/profile/setup` (SSR + client form) y endpoint `POST /api/profile/setup` con Zod y upsert en `profiles` (RLS; sin Service Role). Elimina dependencia de Sheets.
- Perfiles de usuario:
  - Implementado: `/me` con edición de nombre, titular, ciudad, años, bio y avatar URL (envía a `/api/profile/setup` con Zod, RLS).
  - Pendiente: pública `/profiles/[id]` (nombre, headline, galería, rating) para matching.
- Chat con candado (UI):
  - Implementado: componente Chat en `/requests/[id]` (no página separada `/requests/[id]/chat`), validación regex y conexión a `/api/messages`.
- Pagos básicos (Stripe fee $50 MXN):
  - Implementado: `POST /api/stripe/checkout` y webhook; CTA de checkout expuesto desde Postulaciones y botón “Pagar fee” en Acuerdos cuando el acuerdo está aceptado.
- UI limpieza mínima:
  - Implementado: `/applied` (postulaciones del pro) + redirect desde `/applications`.
  - Pendiente: redirección `/my-requests → /requests?mine=1`.
  - Pendiente: ocultar/ajustar `/dashboard` hasta contenido mínimo.

Prioridad micro‑pasos (propuesta):
- Crear `/profile/setup` (server+client) con Zod y `profiles` upsert.
- Añadir `/profiles/[id]` pública con SSR y RLS-friendly fetch.
- Mover CTA “Pagar fee” al bloque de Acuerdos (reutilizar `POST /api/stripe/checkout`).
- Implementar `/applied` (lista `applications` por `professional_id = auth.uid()`).
- Redirigir `/my-requests` y ajustar visibilidad de `/dashboard`.

### Fase 2 — Experiencia completa V1 (46 semanas)
- Adjuntos y galería:
  - Parcial: `requests.attachments` se listan; agregado formulario con subida a bucket `requests` en `/requests/new` (validación MIME/5MB, URLs públicas).
  - Implementado: Galería profesional con bucket `profiles-gallery`:
    - Subida en `/profile/setup` (client) con validación 5MB/MIME y previsualización básica.
    - API `GET/DELETE /api/profiles/[id]/gallery` (server, service-role) para listar/eliminar.
    - Visualización en `/profiles/[id]` (grid con links a full).
  - Pendiente: políticas de Storage declarativas (RLS de Storage) y firma de URLs cuando se requiera privacidad.
  - Pendiente: galería profesional (`profiles-gallery`) + validación.
- Matching automático:
  - Implementado: `GET /api/requests/[id]/prospects` (RPC) y UI `Prospects` en detalle de solicitud.
  - Pendiente: Vista dedicada de “profesionales sugeridos” si se separa del detalle.
- Notificaciones y correos:
  - Implementado: plantillas HTML + envío multipart (HTML + texto) con `from` configurable vía `MAIL_FROM`/`MAIL_FROM_ADDRESS` en `lib/email.ts` (fallback a nombre del sitio). Si no hay `MAIL_PROVIDER_KEY`, no-op.
  - Pendiente: cobertura de todos los eventos clave (auditar contra DM).
- Flujos de cierre y estados:
  - Parcial: acciones en UI para `applications` y `agreements` existen; auditar transición automática a `completed` con doble confirmación.
- UI consistente y moderna:
  - Parcial: Toaster `sonner` activo; pendiente unificación de componentes y FAQ reales en Centro de ayuda.

## Storage — Buckets y Policies
- Buckets creados por migración (`supabase/migrations/20250902T100000_storage_buckets_and_policies.sql`):
  - `requests` (público lectura en V1): 5MB, `image/*`. Insert con prefijo `auth.uid()/...` o `anon/...` (opcional, desactivable).
  - `profiles-gallery` (privado): 5MB, `image/*`. Insert/delete sólo por owner con prefijo `auth.uid()/...`. Lectura vía URLs firmadas (1h).
- Recomendación: a futuro, mover `requests` a privado y usar URLs firmadas también.

### Fase 3 — Extensiones V1.1+
- KYC e inactividad: pendiente (pg_cron semanal, reactivación, validaciones ligeras).
- Calificaciones y reseñas: pendiente (rating post-servicio y reglas de baja).
- Paneles reales: pendiente (cliente/pro completo con historial y métricas).
- Ingresos adicionales: pendiente (destacados $49 MXN y publicidad administrable).
- Escalabilidad: pendiente (geohash, realtime chat, marketplace exploratorio).

---

## Cambios aplicados (detalle)
1. **Supabase SSR (`lib/_supabase-server.ts`)**
   - Exporta:
     - `getSupabaseServer()` y alias `supabaseServer`.
     - `getAuthContext(): { supabase, user | null }`.
     - `getUserOrThrow(): { supabase, user }` (lanza `ApiError(401,"UNAUTHORIZED")` sin sesión).
     - `class ApiError` con `status`, `code`, `detail`.
   - Tipos explícitos desde `@supabase/supabase-js` (sin `any`).
   - Sin uso de `headers` no soportado por `@supabase/ssr`.

2. **Rutas API**
   - **`/api/health`** (App Router): responde `200` JSON UTF-8, fallback Pages API eliminado.
   - **`/api/applications`**:
     - `GET`: lista por `professional_id = user.id`, orden desc; captura de errores PostgREST.
     - `POST`: valida body con Zod; inserta `{ request_id, professional_id, note }`; maneja conflicto `23505`.
     - Manejo de `401` con `try/catch` y `ApiError`.
     - Import/order arreglado y sin `any`.
   - **`/api/applications/[id]`**:
     - `PATCH`: `status` ∈ {accepted,rejected,completed}; retorna registro actualizado.
     - Manejo de `401/400`, JSON UTF-8.
   - **`/api/users/[id]`**:
     - Requiere sesión; `profiles.eq("id", params.id).single()`.
   - **`/api/requests`**:
     - GET/POST con Zod, RLS y consistencia de `Content-Type`; `POST` valida 415 si no es JSON.
   - **`/api/requests/[id]/prospects`**:
     - GET basado en RPC `public.get_prospects_for_request` (security definer). Matching por ciudad/categorías/subcategorías y ranking V1.
   - **`/api/professionals`**:
     - GET con filtros `city/category/page` vía RPC `public.get_professionals_browse` (orden por featured/rating/last_active).
     - POST upsert de perfil autenticado (Zod) actualiza `last_active_at`.
   - **`/api/messages`**:
     - GET con `request_id`, `limit`, `before` (paginación simple).
     - POST con candado (regex) + RLS por relación (dueño/pro) y notificación por email.
   - **`/api/agreements/[id]`**:
     - Import unificado y JSON headers; envía notificación en cambios de estado.
   - **`/api/stripe/webhook`**:
     - Marca `agreements.status='paid'` y actualiza `requests.status='in_process'` al completar checkout.
   - **Rutas de depuración**:
     - `/api/_debug/*` eliminadas por completo (verificación 404).

3. **Middleware y Document**
   - `middleware.ts` con `matcher` que **excluye** `/api/*` (no interfiere con rutas API).
   - `pages/_document.tsx` creado; `app/_document.tsx` eliminado para cumplir `@next/next/no-document-import-in-page`.

4. **Calidad y CI local**
   - **Husky v9+**: hook `pre-commit` sin `husky.sh`, corre `next lint --max-warnings=0` y `tsc --noEmit`.
   - `.gitattributes` fuerza **LF** en `.husky/*` y `*.sh` (evita fallas en Windows).
   - Limpieza de cachés: manejo de errores **EPERM/OneDrive** documentado (cerrar Node, `rm -rf .next node_modules`, `npm ci`).

5. **UI – Header (alineación y mobile)**
   - Ancho alineado al contenido principal: contenedor del header actualizado a `max-w-5xl` + `mx-auto px-4`.
   - Logo actualizado a 64×64 (`h-16 w-16 object-contain`).
   - Mobile: botón de menú movido al lado izquierdo; logo centrado en pantallas pequeñas y alineado a la izquierda en escritorio.

6. **Auth – Logout**
   - Ruta `POST /auth/sign-out` (App Router) implementada en server con Supabase (cookies) y redirección `303` a `/`.
   - Botón “Cerrar sesión” agregado en `/me` (perfil) usando `shadcn/ui` (`variant="destructive"`).

---

## Estado por módulo (matriz)
| Módulo/Archivo | Estado | Notas |
|---|---|---|
| `lib/_supabase-server.ts` | ✅ Listo | Tipado estricto, `ApiError`, helpers unificados. |
| `app/api/health` | ✅ Listo | 200 JSON UTF-8. |
| `app/api/applications` (GET/POST) | ✅ Listo | Sin `any`, Zod + PostgrestError, 401 limpio. |
| `app/api/applications/[id]` (PATCH) | ✅ Listo | Validación Zod, error handling. |
| `app/api/users/[id]` | ✅ Listo | Lee `profiles` por `id` con sesión. |
| `app/api/professionals` | ✅ Listo | GET (RPC browse) + POST upsert; Zod + RLS. |
| `app/api/requests/[id]/prospects` | ✅ Listo | RPC `get_prospects_for_request` + ranking. |
| `app/api/messages` (GET/POST) | ✅ Listo | Candado backend, RLS, paginación básica. |
| `app/api/_debug/*` | ⛔ Eliminado | Confirmado 404. |
| `middleware.ts` | ✅ Listo | No intercepta `/api/*`. |
| `pages/_document.tsx` | ✅ Listo | Cumple regla Next. |
| Husky pre-commit | ✅ Activo | Bloquea lint/TS; LF en hooks. |
| `lib/email.ts` + `lib/email-templates.ts` | ✅ Listo | Envío Resend-like; plantillas HTML + deep links. |
| `lib/notifications.ts` | ✅ Listo | Notifica en create/update (apps/agreements/messages). |
| `app/api/stripe/webhook` | ✅ Listo | `paid` + request `in_process`. |
| `components/site-header.tsx` | ✅ Actualizado | `max-w-5xl`, logo 64px; logo centrado en mobile; menú móvil a la izquierda. |
| `app/auth/sign-out` | ✅ Nuevo | Maneja `POST` y redirige con 303 a `/`. |
| `app/(app)/me/page.tsx` | ✅ Actualizado | Botón “Cerrar sesión” visible si hay sesión. |

---

## Pruebas rápidas (curl)
```bash
# Salud
curl -i -H "Content-Type: application/json; charset=utf-8" http://localhost:3000/api/health

# Applications (sin sesión ⇒ 401; con sesión ⇒ 200)
curl -i -H "Content-Type: application/json; charset=utf-8" http://localhost:3000/api/applications

# Applications PATCH (requiere sesión)
curl -i -X PATCH -H "Content-Type: application/json; charset=utf-8" \
  --data '{"status":"accepted"}' \
  http://localhost:3000/api/applications/11111111-1111-1111-1111-111111111111

# Logout (POST; redirige 303 a /)
curl -i -X POST -H "Content-Type: application/json; charset=utf-8" \
  http://localhost:3000/auth/sign-out

---

## Nuevos artefactos y migraciones
- `docs/api_e2e_rest.http`: recorrido E2E (health, requests, applications, agreements, messages, professionals, stripe checkout). Usa `Content-Type: application/json; charset=utf-8` y captura de IDs.
- `scripts/migrate.ps1`: aplica SQL en `supabase/migrations` con Supabase CLI o `psql` (usa `SUPABASE_DB_URL`).
- Migraciones:
  - `20250816T000000_schema_v1.sql`: esquema base + RLS + triggers.
  - `20250831T120000_applications_with_profile_basic.sql`: RPC `get_applications_with_profile_basic`.
  - `20250831T140500_prospects_for_request.sql`: RPC matching/ranking de prospectos.
  - `20250831T141500_professionals_browse_rpc.sql`: RPC exploración de profesionales.
  - `20250831T142000_messages_table_rls.sql`: tabla `messages` + RLS.
  - `20250831T143000_inactividad_cron.sql`: función y job (pg_cron) de inactividad (best-effort).

## Backlog siguiente iteración
- Botón CTA en plantillas como `<a class="btn">` ya soportado; verificar `NEXT_PUBLIC_SITE_URL` en ambientes.
- Versión de texto plano para correos (multipart) y `from` configurable en `lib/email.ts`.
- Límite de archivos (Storage) y validación MIME/tamaño (front y backend) según DM §12.
- QA con sesión real (cookies Supabase) y Stripe webhook en entorno con claves.
