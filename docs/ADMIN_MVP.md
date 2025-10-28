# Homaid Admin MVP (/admin)

Este MVP agrega el área de administración /admin con navegación, layout, guardas de acceso (middleware), endpoints mock, tablas y KPIs.

## Requisitos

- Node 18+
- Variables de entorno Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Opcional: `ADMIN_EMAILS` (lista separada por coma para whitelisting)

## Instalar dependencias

```
npm i
```

Se añadieron: `@tanstack/react-table`, `recharts`, `zustand`.

## Ejecutar en local

```
npm run dev
```

Luego visita `http://localhost:3000/admin`.

## Acceso y RBAC

- Middleware protege `/admin`. Permite roles: `owner, admin, ops, finance, support, reviewer` o `profiles.is_admin = true`.
- Como fallback de desarrollo, puedes autorizar por correo con `ADMIN_EMAILS=email1@example.com,email2@...`.

## Endpoints mock (Next Route Handlers)

- `GET /api/admin/metrics` (KPIs + serie de tiempo)
- `GET /api/admin/requests` (lista paginada demo)
- `GET /api/admin/professionals`
- `GET /api/admin/payments`
- `GET /api/admin/webhooks`
- `GET /api/admin/audit`
- `POST /api/admin/settings` (valida y responde OK; en prod guardarías en DB)

Todos usan `lib/auth-admin.assertAdminOrJson()` como guarda.

## UI/Admin

- Layout: `app/admin/layout.tsx` con sidebar (móvil y desktop) y topbar.
- Dashboard: KPIs + gráfica (Recharts).
- Solicitudes: tabla con filtros (TanStack Table + Zustand).
- Profesionales: listado KYC.
- Pagos: read-only.
- Configuración: formulario comisión/IVA validado con Zod.
- Sistema: monitor de webhooks + audit log.
- Stubs: rutas dinámicas bajo `/admin/[...stub]` para futuras secciones.

## SQL (Supabase)

Migración: `supabase/migrations/20251022_admin_mvp.sql`

- `has_admin_access()` función SECURITY DEFINER para RLS admin.
- `admin_settings` (commission_percent, vat_percent) + RLS select/update para admin.
- `audit_log` + RLS select/insert para admin.
- `webhook_events` + RLS select/insert para admin.

Seed demo: `supabase/seed_admin.sql` (audit y webhooks).

Aplica con el CLI:

```
supabase migration up --linked
supabase db execute --file supabase/seed_admin.sql
```

## Notas

- El esquema actual del proyecto ya incluye `profiles` y autorización con Supabase SSR. El middleware ahora también verifica permisos en `/admin`.
- Este MVP usa datos mock en endpoints. Conecta a tus tablas reales reemplazando la lógica de `/api/admin/*`.

