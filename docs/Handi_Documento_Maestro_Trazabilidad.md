# Homaid — Trazabilidad de Tablas (Post-separación de profesionales)

Objetivo: documentar el flujo de datos y la responsabilidad de cada tabla/bucket tras separar el perfil profesional público de `profiles` a `professionals`.

## 1) Entidades principales

- `auth.users`: identidad y metadatos del usuario (Supabase Auth).
- `public.profiles` (perfil de usuario):
  - id (PK = auth.users.id), full_name, avatar_url, role (`client|pro|admin`), created_at.
  - RLS: select/insert/update propios.
  - Uso: cabecera, permisos, vistas de cuenta.

- `public.pro_applications` (postulaciones):
  - user_id (FK auth.users), full_name, phone, email, services_desc, cities (jsonb), categories (jsonb), subcategories (jsonb), years_experience, refs (jsonb), uploads (jsonb), status (`pending|accepted|rejected`).
  - RLS: el propio usuario puede insertar/leer; admins via service role.
  - Uso: onboarding y validación.

- `public.professionals` (perfil profesional público):
  - id (PK = auth.users.id), full_name, avatar_url, headline, bio, years_experience, rating, is_featured, active, city, cities (jsonb), categories (jsonb), subcategories (jsonb), last_active_at, created_at.
  - RLS:
    - select público si `active != false`.
    - insert/update sólo dueño (auth.uid() = id).
  - Uso: listado/búsqueda/matching/perfiles públicos.

- `public.requests`, `public.applications`, `public.agreements`: sin cambios estructurales relevantes a este addendum (salvo `applications.note` añadido si faltaba).

## 2) Buckets de Storage

- `requests`: imágenes de solicitudes (público o firmado, según política).
- `professionals-gallery`: galería del profesional (lectura por URL firmada); prefijo `<user_id>/...`.
- `profiles-gallery` (deprecado): se mantiene temporalmente para migrar objetos.

## 3) Endpoints relevantes (App Router)

- Listado público de profesionales: `GET /api/professionals?city=&category=&subcategory=&page=&include_incomplete=0|1`.
  - Fuente: `public.professionals` (filtros en BD + normalización y filtros en memoria).
- Perfil público: `GET /api/profiles/:id` (bajo el capó usa `public.professionals`).
- Galería profesional: `GET /api/professionals/:id/gallery` (bucket `professionals-gallery`).
- Aprobación admin (pro): `POST /api/admin/pro-applications/:id/status` → si `accepted`, upsert en `public.professionals`.
- Setup profesional: `POST /api/profile/setup` → upsert en `public.professionals`.

## 4) RPCs y consultas en BD

- `get_professionals_browse(p_city, p_category)` → ahora lee de `public.professionals`.
- `get_prospects_for_request(p_request_id)` → ahora evalúa matching contra `public.professionals`.
- `get_applications_with_profile_basic(p_request_id)` → ahora joinea `public.professionals` (y expone `a.note` si existe).

## 5) Flujo de datos resumido

1. Usuario se registra → `auth.users` + `public.profiles` (rol por defecto `client`).
2. Se postula como profesional → `public.pro_applications`.
3. Admin aprueba → sincroniza a `public.professionals` y puede ajustar `profiles.role='pro'`.
4. Profesional edita su vitrina (headline/bio/ciudades/categorías) → `public.professionals`.
5. Listado y matching usan `public.professionals`.
6. Galería profesional se gestiona en `professionals-gallery` (`/api/professionals/:id/gallery`).

## 6) Tareas de migración/operación

- Migraciones SQL:
  - `20250912090000_professionals_table.sql`, `20250912090500_update_professionals_browse_rpc.sql`, `20250912091000_backfill_professionals_from_profiles.sql`.
  - `20250912102000_professionals_gallery_bucket.sql`.
  - `20250912103000_update_applications_with_profile_basic_to_professionals.sql`, `20250912103500_update_prospects_for_request_to_professionals.sql`.
  - `20250912104000_add_applications_note_column.sql`, `20250912104100_update_applications_with_profile_basic_use_note.sql`.
- Script de copia de galería: `scripts/migrate-professionals-gallery.mjs`.
- Limpieza de columnas en `profiles`: `20250912100000_cleanup_profiles_columns.sql`.

## 7) Notas

- `active` controla visibilidad pública en `professionals`. En el endpoint se excluye `active=false`; `null` se considera visible por compatibilidad.
- Para “solo publicables”, reforzar la edición para exigir `full_name` y mantener `active=true` al publicar.

