# Estado de ImplementaciÃ³n vs Documento Maestro â€“ Handi Webapp
<!-- Renombrado desde *_Handee_* a *_Handi_* -->

**Ãšltima actualizaciÃ³n:** 2025-09-12 (America/Monterrey)

## Resumen ejecutivo

- ðŸŸ¨ Lint/TS: hay pendientes menores existentes (import/order en `components/UpdateEmailForm.tsx` y `no-explicit-any` en `app/api/test-seed/route.ts`).
- â³ Build: no ejecutado en esta revisiÃ³n (previo OK).
- âœ… Auth SSR (Supabase) consolidado en `lib/_supabase-server.ts` (cookies, `getUserOrThrow`).
- âœ… ConvenciÃ³n de headers: respuestas JSON con `application/json; charset=utf-8`.
- âœ… API alineada al DM: requests, applications, agreements, professionals, prospects, chat (conversations), stripe.
- âœ… UI: ajustes al header para ancho/posiciÃ³n segÃºn DM UX; panel de Prospectos y Chat con candado (previo).
- âœ… Notificaciones: plantillas HTML y deep links (Resend-like; no-op sin claves).
- âœ… Calidad: Husky + Lint/TS; script de migraciones y archivo REST E2E.

---

## Plan por Fases (DM) â€” Estado y brechas

### Fase 1 â€” ConsolidaciÃ³n bÃ¡sica (23 semanas)

- Onboarding profesionales inâ€‘app:
- Implementado: UI `/profile/setup` (SSR + client form) y endpoint `POST /api/profile/setup` con Zod y upsert en `professionals` (RLS; sin Service Role). Elimina dependencia de Sheets.
- Perfiles (usuario y profesional):
  - Implementado: `/me` edita datos de usuario (mÃ­nimos). Perfil profesional se edita en `/profile/setup` (headline, bio, ciudades, categorÃ­as, etc.) guardando en `professionals`.
  - Implementado: pÃºblica `/profiles/[id]` (nombre, headline, bio, rating, galerÃ­a) leyendo de `professionals`.
- Chat con candado (UI):
  - Implementado: componente Chat en `/requests/[id]` (no pÃ¡gina separada `/requests/[id]/chat`), validaciÃ³n regex y conexiÃ³n a `/api/messages`.
- Pagos bÃ¡sicos (Stripe fee $50 MXN):
  - Implementado: `POST /api/stripe/checkout` y webhook; CTA de checkout expuesto desde Postulaciones y botÃ³n â€œPagar feeâ€ en Acuerdos cuando el acuerdo estÃ¡ aceptado.
- UI limpieza mÃ­nima:
  - Implementado: `/applied` (postulaciones del pro) + redirect desde `/applications`.
  - Pendiente: redirecciÃ³n `/my-requests â†’ /requests?mine=1`.
  - Pendiente: ocultar/ajustar `/dashboard` hasta contenido mÃ­nimo.

Prioridad microâ€‘pasos (propuesta):

- Crear `/profile/setup` (server+client) con Zod y `profiles` upsert.
- AÃ±adir `/profiles/[id]` pÃºblica con SSR y RLS-friendly fetch.
- Mover CTA â€œPagar feeâ€ al bloque de Acuerdos (reutilizar `POST /api/stripe/checkout`).
- Implementar `/applied` (lista `applications` por `professional_id = auth.uid()`).
- Redirigir `/my-requests` y ajustar visibilidad de `/dashboard`.

### Fase 2 â€” Experiencia completa V1 (46 semanas)

- Adjuntos y galerÃ­a:
  - Parcial: `requests.attachments` se listan; subida a bucket `requests` (validaciones 5MB/MIME) en `/requests/new`.
  - Implementado: GalerÃ­a profesional con bucket `professionals-gallery` (reemplaza `profiles-gallery`):
    - API `GET/DELETE /api/professionals/[id]/gallery` (server, service-role) para listar/eliminar con URLs firmadas.
    - VisualizaciÃ³n en `/profiles/[id]` (grid con links a full).
    - Script de migraciÃ³n de objetos: `scripts/migrate-professionals-gallery.mjs`.
- Matching automÃ¡tico:
  - Implementado: `GET /api/requests/[id]/prospects` (RPC) y UI `Prospects` en detalle de solicitud.
  - Pendiente: Vista dedicada de â€œprofesionales sugeridosâ€ si se separa del detalle.
- Notificaciones y correos:
  - Implementado: plantillas HTML + envÃ­o multipart (HTML + texto) con `from` configurable vÃ­a `MAIL_FROM`/`MAIL_FROM_ADDRESS` en `lib/email.ts` (fallback a nombre del sitio). Si no hay `MAIL_PROVIDER_KEY`, no-op.
  - Pendiente: cobertura de todos los eventos clave (auditar contra DM).
- Flujos de cierre y estados:
  - Parcial: acciones en UI para `applications` y `agreements` existen; auditar transiciÃ³n automÃ¡tica a `completed` con doble confirmaciÃ³n.
- UI consistente y moderna:
  - Parcial: Toaster `sonner` activo; pendiente unificaciÃ³n de componentes y FAQ reales en Centro de ayuda.

## Storage â€” Buckets y Policies

- Buckets activos por migraciÃ³n:
  - `requests` (lectura pÃºblica en V1): 5MB, `image/*`. Insert con prefijo `auth.uid()/...` o `anon/...` (opcional, desactivable).
  - `professionals-gallery` (privado): 5MB, `image/*`. Insert/delete sÃ³lo por owner con prefijo `auth.uid()/...`. Lectura vÃ­a URLs firmadas (1h).
  - `profiles-gallery` (deprecado): mantener temporalmente para compatibilidad y migraciÃ³n.
- RecomendaciÃ³n: a futuro, mover `requests` a privado y usar URLs firmadas tambiÃ©n.

### Fase 3 â€” Extensiones V1.1+

- KYC e inactividad: pendiente (pg_cron semanal, reactivaciÃ³n, validaciones ligeras).
- Calificaciones y reseÃ±as: pendiente (rating post-servicio y reglas de baja).
- Paneles reales: pendiente (cliente/pro completo con historial y mÃ©tricas).
- Ingresos adicionales: pendiente (destacados $49 MXN y publicidad administrable).
- Escalabilidad: pendiente (geohash, realtime chat, marketplace exploratorio).

---

## Cambios aplicados (detalle)

1. **Supabase SSR (`lib/_supabase-server.ts`)**
   - Exporta:
     - `getSupabaseServer()` y alias `supabaseServer`.
     - `getAuthContext(): { supabase, user | null }`.
     - `getUserOrThrow(): { supabase, user }` (lanza `ApiError(401,"UNAUTHORIZED")` sin sesiÃ³n).
     - `class ApiError` con `status`, `code`, `detail`.
   - Tipos explÃ­citos desde `@supabase/supabase-js` (sin `any`).
   - Sin uso de `headers` no soportado por `@supabase/ssr`.

2. **Rutas API**
   - **`/api/health`** (App Router): responde `200` JSON UTF-8, fallback Pages API eliminado.
   - **`/api/applications`**:
     - `GET`: lista por `professional_id = user.id`, orden desc; captura de errores PostgREST.
     - `POST`: valida body con Zod; inserta `{ request_id, professional_id, note }`; maneja conflicto `23505`.
     - Manejo de `401` con `try/catch` y `ApiError`.
     - Import/order arreglado y sin `any`.
   - **`/api/applications/[id]`**:
     - `PATCH`: `status` âˆˆ {accepted,rejected,completed}; retorna registro actualizado.
     - Manejo de `401/400`, JSON UTF-8.
   - **`/api/users/[id]`**:
     - Requiere sesiÃ³n; `profiles.eq("id", params.id).single()`.
   - **`/api/requests`**:
     - GET/POST con Zod, RLS y consistencia de `Content-Type`; `POST` valida 415 si no es JSON.
   - **`/api/requests/[id]/prospects`**:
     - GET basado en RPC `public.get_prospects_for_request` (security definer). Matching por ciudad/categorÃ­as/subcategorÃ­as y ranking V1.
   - **`/api/professionals`**:
     - GET con filtros `city/category/page` vÃ­a RPC `public.get_professionals_browse` (orden por featured/rating/last_active).
     - POST upsert de perfil autenticado (Zod) actualiza `last_active_at`.
   - **`/api/messages`**:
     - GET con `request_id`, `limit`, `before` (paginaciÃ³n simple).
     - POST con candado (regex) + RLS por relaciÃ³n (dueÃ±o/pro) y notificaciÃ³n por email.
   - **`/api/agreements/[id]`**:
     - Import unificado y JSON headers; envÃ­a notificaciÃ³n en cambios de estado.
   - **`/api/stripe/webhook`**:
     - Marca `agreements.status='paid'` y actualiza `requests.status='in_process'` al completar checkout.
   - **Rutas de depuraciÃ³n**:
     - `/api/_debug/*` eliminadas por completo (verificaciÃ³n 404).

3. **Middleware y Document**
   - `middleware.ts` con `matcher` que **excluye** `/api/*` (no interfiere con rutas API).
   - `pages/_document.tsx` creado; `app/_document.tsx` eliminado para cumplir `@next/next/no-document-import-in-page`.

4. **Calidad y CI local**
   - **Husky v9+**: hook `pre-commit` sin `husky.sh`, corre `next lint --max-warnings=0` y `tsc --noEmit`.
   - `.gitattributes` fuerza **LF** en `.husky/*` y `*.sh` (evita fallas en Windows).
   - Limpieza de cachÃ©s: manejo de errores **EPERM/OneDrive** documentado (cerrar Node, `rm -rf .next node_modules`, `npm ci`).

5. **UI â€“ Header (alineaciÃ³n y mobile)**
   - Ancho alineado al contenido principal: contenedor del header actualizado a `max-w-5xl` + `mx-auto px-4`.
   - Logo actualizado a 64Ã—64 (`h-16 w-16 object-contain`).
   - Mobile: botÃ³n de menÃº movido al lado izquierdo; logo centrado en pantallas pequeÃ±as y alineado a la izquierda en escritorio.

6. **Auth â€“ Logout**
   - Ruta `POST /auth/sign-out` (App Router) implementada en server con Supabase (cookies) y redirecciÃ³n `303` a `/`.
   - BotÃ³n â€œCerrar sesiÃ³nâ€ agregado en `/me` (perfil) usando `shadcn/ui` (`variant="destructive"`).

---

## Estado por mÃ³dulo (matriz)

| MÃ³dulo/Archivo                            | Estado         | Notas                                                                       |
| ----------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| `lib/_supabase-server.ts`                 | âœ… Listo       | Tipado estricto, `ApiError`, helpers unificados.                            |
| `app/api/health`                          | âœ… Listo       | 200 JSON UTF-8.                                                             |
| `app/api/applications` (GET/POST)         | âœ… Listo       | Sin `any`, Zod + PostgrestError, 401 limpio.                                |
| `app/api/applications/[id]` (PATCH)       | âœ… Listo       | ValidaciÃ³n Zod, error handling.                                             |
| `app/api/users/[id]`                      | âœ… Listo       | Lee `profiles` por `id` con sesiÃ³n.                                         |
| `app/api/professionals`                   | âœ… Listo       | GET (filtros/paginaciÃ³n/depurador) desde `professionals` + POST upsert.     |
| `app/api/requests/[id]/prospects`         | âœ… Listo       | RPC `get_prospects_for_request` + ranking.                                  |
| `app/api/messages` (GET/POST)             | âœ… Listo       | Candado backend, RLS, paginaciÃ³n bÃ¡sica.                                    |
| `app/api/_debug/*`                        | â›” Eliminado   | Confirmado 404.                                                             |
| `middleware.ts`                           | âœ… Listo       | No intercepta `/api/*`.                                                     |
| `pages/_document.tsx`                     | âœ… Listo       | Cumple regla Next.                                                          |
| Husky pre-commit                          | âœ… Activo      | Bloquea lint/TS; LF en hooks.                                               |
| `lib/email.ts` + `lib/email-templates.ts` | âœ… Listo       | EnvÃ­o Resend-like; plantillas HTML + deep links.                            |
| `lib/notifications.ts`                    | âœ… Listo       | Notifica en create/update (apps/agreements/messages).                       |
| `app/api/stripe/webhook`                  | âœ… Listo       | `paid` + request `in_process`.                                              |
| `components/site-header.tsx`              | âœ… Actualizado | `max-w-5xl`, logo 64px; logo centrado en mobile; menÃº mÃ³vil a la izquierda. |
| `app/auth/sign-out`                       | âœ… Nuevo       | Maneja `POST` y redirige con 303 a `/`.                                     |
| `app/(app)/me/page.tsx`                   | âœ… Actualizado | BotÃ³n â€œCerrar sesiÃ³nâ€ visible si hay sesiÃ³n.                                |

---

## Pruebas rÃ¡pidas (curl)

```bash
# Salud
curl -i -H "Content-Type: application/json; charset=utf-8" http://localhost:3000/api/health

# Applications (sin sesiÃ³n â‡’ 401; con sesiÃ³n â‡’ 200)
curl -i -H "Content-Type: application/json; charset=utf-8" http://localhost:3000/api/applications

# Applications PATCH (requiere sesiÃ³n)
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
  - `20250831T120000_applications_with_profile_basic.sql`: RPC `get_applications_with_profile_basic` (legacy; actualizado en 20250912 a `professionals`).
  - `20250831T140500_prospects_for_request.sql`: RPC matching/ranking (legacy; actualizado en 20250912 a `professionals`).
  - `20250831T141500_professionals_browse_rpc.sql`: RPC exploraciÃ³n (legacy; actualizado en 20250912 a `professionals`).
  - `20250831T142000_messages_table_rls.sql`: tabla `messages` + RLS.
  - `20250831T143000_inactividad_cron.sql`: funciÃ³n y job (pg_cron) de inactividad (best-effort).
  - `20250912090000_professionals_table.sql`: tabla `professionals` + RLS/Ã­ndices.
  - `20250912090500_update_professionals_browse_rpc.sql`: browse en `professionals`.
  - `20250912091000_backfill_professionals_from_profiles.sql`: seed inicial desde `profiles`.
  - `20250912100000_cleanup_profiles_columns.sql`: limpieza de columnas en `profiles`.
  - `20250912104500_add_empresa_flags.sql`: agrega bandera `empresa` a `pro_applications` y `professionals`.

## ActualizaciÃ³n: PostulaciÃ³n como empresa

- Formulario `/pro-apply`: se aÃ±adiÃ³ la casilla â€œMe postulo como empresaâ€.
- API `/api/pro-applications` y `/api/profile/setup` aceptan el campo booleano `empresa`.
- Al aprobar una postulaciÃ³n (admin), el campo `empresa` se propaga al perfil pÃºblico en `professionals`.
  - `20250912102000_professionals_gallery_bucket.sql`: bucket y RLS para `professionals-gallery`.
  - `20250912103000_update_applications_with_profile_basic_to_professionals.sql`: `applications` + `professionals`.
  - `20250912103500_update_prospects_for_request_to_professionals.sql`: `prospects` desde `professionals`.
  - `20250912104000_add_applications_note_column.sql`: aÃ±ade `applications.note` si falta.
  - `20250912104100_update_applications_with_profile_basic_use_note.sql`: re-crea funciÃ³n usando `a.note`.

## Backlog siguiente iteraciÃ³n
- BotÃ³n CTA en plantillas como `<a class="btn">` ya soportado; verificar `NEXT_PUBLIC_APP_URL` en ambientes (o `NEXT_PUBLIC_SITE_URL` como fallback).
- VersiÃ³n de texto plano para correos (multipart) y `from` configurable en `lib/email.ts`.
- LÃ­mite de archivos (Storage) y validaciÃ³n MIME/tamaÃ±o (front y backend) segÃºn DM Â§12.
- QA con sesiÃ³n real (cookies Supabase) y Stripe webhook en entorno con claves.
```

