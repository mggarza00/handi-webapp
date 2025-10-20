# Handi — Documento Maestro V1 (Unificado)
<!-- Renombrado desde *_Handee_* a *_Handi_* -->

**Fecha:** 13-ago-2025  
**Estado:** Versión consolidada y aprobada para desarrollo  
**Stack:** Next.js 14, Supabase (Postgres + Auth + Storage), Tailwind, shadcn/ui  
**Convención:** En todas las peticiones HTTP usar `Content-Type: application/json; charset=utf-8`.

---

## 0) Resumen ejecutivo

Handi conecta **contratantes** con **profesionales** de oficios. El V1 integra:

- **Solicitudes** (requests) y **postulaciones** (applications).
- **Matching** por categoría/subcategoría y **ubicación**.
- **Ranking** de prospectos: `is_featured` → `rating` → `distancia` → `recencia` (máx 20).
- **Chat con candado** (bloqueo de datos personales en front + backend).
- **Pagos iniciales**: fee de **$50 MXN** vía Stripe para desbloquear datos (opción efectivo). Handi **recibe** y **paga manualmente** tras doble confirmación.
- **Estados y acuerdos**: múltiples acuerdos por solicitud, con flujo `negotiating → accepted → paid → in_progress → completed / cancelled / disputed`.
- **Validación básica** de profesionales (sin KYC completo en V1).
- **Inactividad**: se marca inactivo a los 21 días sin interacción; reactivación al iniciar sesión.
- **Límites de archivos**: solicitudes/galería con tamaños y formatos permitidos.
- **Notificaciones** por email y en la app.
- **Panel/Historial** con filtros por estado.

---

## 1) Alcance V1

### Incluye

- Auth (Supabase): Email + Google; sesión persistente; SSR cookies.
- CRUD de `requests`, `applications`; **agreements** (mínimo viable) para pagos.
- Matching y ranking.
- Chat con candado (validador + regex + reglas backend).
- Pagos: Stripe Checkout para fee $50 MXN + webhook; opción efectivo posterior al fee.
- Estados y transiciones automáticas básicas.
- Notificaciones (email y en-app).
- Panel profesional y contratante con historial.
- Validación profesional (foto, headline, bio, categorías, ciudades, años, certificaciones opc.).

### Excluye (V1)

- Escrow/cuenta puente real.
- Mensajería en tiempo real “rica” (usar stub/cola simple).
- Motor de reputación avanzado / antifraude.
- KYC avanzado (entra en V1.1).

---

## 2) Arquitectura técnica

- **Frontend:** Next.js 14 (App Router), Tailwind, shadcn/ui, fetch API, componentes client/server.
- **Backend:** Supabase (Auth + Postgres + RLS + Storage + Edge Functions opc.).
- **Integraciones:** Stripe (fee), Resend/SMTP (emails).
- **Ambiente (.env.local):**
  - `NEXT_PUBLIC_SUPABASE_URL=`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
  - `SUPABASE_SERVICE_ROLE_KEY=` (solo server)
  - `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`
  - `NEXT_PUBLIC_STRIPE_PRICE_FEE_MXN=50` (o el ID de Price)
  - `MAIL_PROVIDER_KEY=` (Resend/SMTP)
- **Buckets Storage:**
  - `requests` (imágenes de solicitudes)
  - `profiles-gallery` (galería profesional)
- **Regla general:** máximo 5MB por imagen; JPG/PNG/WebP; no video en V1.

---

## 3) Modelo de datos (Postgres / Supabase)

Nota (addendum septiembre 2025): El perfil profesional público se separa de `profiles` y vive en `public.professionals`. La galería de profesionales se aloja en el bucket `professionals-gallery`. Las secciones originales se mantienen por referencia histórica; ver el anexo 3.6 para el diseño vigente y trazabilidad.

Addendum (septiembre 2025 — empresas): Los profesionales pueden postularse como empresa. Se agrega la bandera booleana `empresa` en:
- `public.pro_applications (empresa boolean default false)` para registrar si la postulación es de empresa.
- `public.professionals (empresa boolean default false)` para marcar el perfil público como empresa.

UI: En el formulario de postulación (`/pro-apply`) se incorpora la casilla “Me postulo como empresa”, persistida en la solicitud y en el perfil público al aprobarse.

> **Extensiones**: `uuid-ossp`, `pgcrypto`

### 3.1 Esquema (DDL)

```sql
-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('client','pro')) default 'client',
  avatar_url text,
  headline text,
  bio text,
  years_experience int,
  rating numeric,                 -- 0..5 (null si no aplica)
  is_featured boolean default false,
  active boolean default true,
  city text,
  cities jsonb default '[]'::jsonb,       -- lista de ciudades donde ofrece servicio
  categories jsonb default '[]'::jsonb,   -- [{id, name}]
  subcategories jsonb default '[]'::jsonb, -- [{id, name}]
  last_active_at timestamptz,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- REQUESTS
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  city text,
  category text,
  subcategories jsonb default '[]'::jsonb, -- hasta 6 subcategorías
  budget numeric,
  required_at date,
  status text check (status in ('active','in_process','completed','cancelled')) default 'active',
  attachments jsonb default '[]'::jsonb,   -- [{url,mime,size}]
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.requests enable row level security;

-- APPLICATIONS
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  note text,
  status text check (status in ('applied','accepted','rejected','completed')) default 'applied',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.applications enable row level security;
create unique index if not exists ux_applications_unique_per_pair
  on public.applications (request_id, professional_id);

-- AGREEMENTS (mínimo viable para pagos/confirmaciones)
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  amount numeric, -- monto acordado (si aplica)
  status text check (status in (
    'negotiating','accepted','paid','in_progress','completed','cancelled','disputed'
  )) default 'negotiating',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.agreements enable row level security;

-- Disparadores updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_updated_at_applications on public.applications;
create trigger set_updated_at_applications before update on public.applications
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_agreements on public.agreements;
create trigger set_updated_at_agreements before update on public.agreements
for each row execute function public.tg_set_updated_at();
```

### 3.2 RLS Policies

```sql
-- PROFILES
drop policy if exists "profiles.select.own" on public.profiles;
drop policy if exists "profiles.insert.own" on public.profiles;
drop policy if exists "profiles.update.own" on public.profiles;

create policy "profiles.select.own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles.insert.own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles.update.own" on public.profiles
for update using (auth.uid() = id);

-- REQUESTS
drop policy if exists "requests.select.active" on public.requests;
drop policy if exists "requests.select.own" on public.requests;
drop policy if exists "requests.insert.own" on public.requests;
drop policy if exists "requests.update.own" on public.requests;

create policy "requests.select.active" on public.requests
for select using (status = 'active');

create policy "requests.select.own" on public.requests
for select using (created_by = auth.uid());

create policy "requests.insert.own" on public.requests
for insert with check (created_by = auth.uid());

create policy "requests.update.own" on public.requests
for update using (created_by = auth.uid());

-- APPLICATIONS
drop policy if exists "applications.select.own" on public.applications;
drop policy if exists "applications.select.by_request_owner" on public.applications;
drop policy if exists "applications.insert.own" on public.applications;
drop policy if exists "applications.update.own_or_request_owner" on public.applications;

create policy "applications.select.own" on public.applications
for select using (professional_id = auth.uid());

create policy "applications.select.by_request_owner" on public.applications
for select using (exists (
  select 1 from public.requests r
  where r.id = applications.request_id and r.created_by = auth.uid()
));

create policy "applications.insert.own" on public.applications
for insert with check (professional_id = auth.uid());

create policy "applications.update.own_or_request_owner" on public.applications
for update using (
  professional_id = auth.uid()
  or exists (select 1 from public.requests r where r.id = applications.request_id and r.created_by = auth.uid())
);

-- AGREEMENTS
drop policy if exists "agreements.select.parties" on public.agreements;
drop policy if exists "agreements.insert.by_parties" on public.agreements;
drop policy if exists "agreements.update.by_parties" on public.agreements;

create policy "agreements.select.parties" on public.agreements
for select using (
  exists (select 1 from public.requests r where r.id = agreements.request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

create policy "agreements.insert.by_parties" on public.agreements
for insert with check (
  exists (select 1 from public.requests r where r.id = request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);

create policy "agreements.update.by_parties" on public.agreements
for update using (
  exists (select 1 from public.requests r where r.id = agreements.request_id and r.created_by = auth.uid())
  or professional_id = auth.uid()
);
```

### 3.3 Índices sugeridos

```sql
-- Actual (post-separación): índices en professionals
create index if not exists ix_professionals_last_active on public.professionals (last_active_at desc);
create index if not exists ix_professionals_featured_rating on public.professionals (is_featured desc, rating desc nulls last);
create index if not exists ix_requests_status_city on public.requests (status, city);
```

### 3.6 Addendum — Separación de perfil profesional (sept 2025)

Resumen de cambios:
- Tabla nueva `public.professionals` (perfil profesional público). `public.profiles` queda para datos de usuario (rol, avatar básico, nombre de cuenta).
- RPCs y endpoints que listan/buscan profesionales migran a `professionals`.
- Galería de profesionales se mueve a bucket `professionals-gallery`.
- Postulaciones (`public.pro_applications`) siguen como fuente de onboarding; al aceptar se sincroniza a `professionals`.

DDL (resumen):
```sql
create table if not exists public.professionals (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  years_experience int,
  rating numeric,
  is_featured boolean default false,
  active boolean default true,
  city text,
  cities jsonb default '[]'::jsonb,
  categories jsonb default '[]'::jsonb,
  subcategories jsonb default '[]'::jsonb,
  last_active_at timestamptz,
  created_at timestamptz default now()
);
alter table public.professionals enable row level security;

create policy "professionals.select.public" on public.professionals
for select using (coalesce(active, true) = true);
create policy "professionals.insert.own" on public.professionals
for insert with check (auth.uid() = id);
create policy "professionals.update.own" on public.professionals
for update using (auth.uid() = id);

create index if not exists ix_professionals_last_active on public.professionals (last_active_at desc);
create index if not exists ix_professionals_featured_rating on public.professionals (is_featured desc, rating desc nulls last);
```

Buckets de Storage:
- `professionals-gallery` (nuevo): lectura por URL firmada; escritura sólo dueño bajo `<user_id>/...`.
- `profiles-gallery` (deprecado): se mantiene temporalmente para compatibilidad y migración de objetos.

Trazabilidad (end-to-end):
- Registro → `auth.users` + `public.profiles` (rol = client por defecto).
- Postulación → `public.pro_applications`.
- Aprobación admin → upsert en `public.professionals` (activa y normaliza datos) y opcional `profiles.role='pro'`.
- Edición perfil profesional → `public.professionals`.
- Listado/búsqueda/matching → `public.professionals` (+ índices por actividad/destacado).
- Galería → bucket `professionals-gallery` expuesto por `/api/professionals/:id/gallery`.

Referencias (repo): `supabase/migrations/*professionals*`, `app/api/professionals/*`, `app/profiles/[id]`.

---

## 4) Matching & Ranking

- **Filtro**: categorías/subcategorías y cobertura de ciudades del profesional deben intersectar con la solicitud.
- **Orden**: `is_featured` desc → `rating` desc → `distancia` asc → `last_active_at` desc.
- **Paginación**: 20 resultados máx por solicitud.
- **Cálculo distancia**: V1 simple por ciudad; V1.1 con geohash.

---

## 5) Chat con candado

### 5.1 Reglas

**No permitir** números de teléfono, direcciones, correos o URLs.

- Front: validación previa + aviso.
- Backend: validación obligatoria; rechazar mensaje si viola reglas.

### 5.2 Regex de referencia (backend)

- Email: `(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`
- Tel (MX/US): `(?i)(\+?\d{1,3}[\s-]?)?(\(?\d{2,3}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}`
- URL: `(?i)\b((https?:\/\/)|www\.)\S+`
- Dirección: lista negra de palabras tipo `calle|avenida|col\.?|cp|codigo postal|#|no\.?` (heurística)

> Al detectar patrón, **bloquear** y responder: _"No puedes compartir datos personales en el chat."_

---

## 6) Pagos (Fee $50 MXN) y desbloqueo

- **Stripe Checkout** para fee (monto fijo).
- **Webhook** (`/api/stripe/webhook`) para marcar `agreement.status='paid'` y **desbloquear datos** del profesional en esa conversación.
- **Efectivo**: permitido **solo** después de pagar fee.
- **Liberaciones**: Handi libera pago manual al profesional tras **doble confirmación**; **máx 7 días** si el profesional no confirma (liberar de todos modos).
- **Si cliente confirma**: **no hay retracto** (regla V1).

---

## 7) Estados y transiciones

### 7.1 Requests

- `active → in_process` (ambos aceptan o fee pagado)
- `in_process → completed` (doble confirmación)
- `* → cancelled` (manual)

### 7.2 Applications

- `applied → accepted → completed`
- `applied → rejected`

### 7.3 Agreements

- `negotiating → accepted → paid → in_progress → completed`
- En cualquier punto: `cancelled`/`disputed`

---

## 8) Inactividad

- **Regla**: si `profiles.last_active_at` > 21 días, `active=false`.
- **Job**: Supabase cron semanal.
- **Reactivación**: al iniciar sesión → `active=true` y `last_active_at=now()`.

---

## 9) Notificaciones

- Email al profesional cuando aparece como prospecto o cambia su application.
- Email al cliente cuando hay respuesta en chat o cambio de estado.
- Notificación en app (toast/badge).

---

## 10) UI / Pantallas (rutas sugeridas)

- `/` Home (“¿Qué necesitas hoy?” → CTA: Buscar/Ofrecer)
- `/auth/*` Login/Registro
- `/requests` Listado (filtros por categoría/ciudad)
- `/requests/new` Crear solicitud
- `/requests/[id]` Detalle + botón Postúlate
- `/dashboard/client` Mis solicitudes + applications recibidas
- `/dashboard/pro` Mis postulaciones + acuerdos
- `/agreements/[id]` Flujo de acuerdo/pago
- `/profile` Perfil profesional (validación, galería, ciudades, categorías)

---

## 11) Endpoints (Next.js API)

- `GET /api/requests` → lista (RLS: activas + propias)
- `POST /api/requests` → crear
- `POST /api/applications` → `{ request_id, note? }`
- `PATCH /api/applications/:id` → `accepted/rejected/completed`
- `POST /api/agreements` → crear acuerdo (request+pro)
- `PATCH /api/agreements/:id` → `accepted/paid/in_progress/completed/cancelled/disputed`
- `POST /api/stripe/checkout` → inicia checkout del fee
- `POST /api/stripe/webhook` → procesa evento y cambia `agreements.status='paid'`

**Headers**: `Content-Type: application/json; charset=utf-8`.

---

## 12) Límites de archivo (Storage)

- **Solicitudes:** hasta 5 imágenes, 5MB c/u, JPG/PNG/WebP; no videos.
- **Galería profesional:** hasta 10 imágenes, mismas reglas.
- Validar MIME + tamaño en front y backend.

---

## 13) QA — Pruebas clave

1. Crear solicitud (con/sin login → 401 si no hay sesión).
2. Postularse una vez por solicitud (único por par request/pro).
3. Ranking respeta `featured`/`rating`/`distancia`/`recencia`.
4. Chat bloquea datos personales (front+backend).
5. Stripe fee → webhook → desbloqueo.
6. Doble confirmación → completed y liberación manual.
7. Inactividad 21 días → active=false; reactivación al login.

---

## 14) Seguridad

- **RLS activa** en todas las tablas.
- Nunca exponer `service_role` al cliente.
- Validación de inputs en server; sanitizar HTML si se permite rich text.
- Logs de errores y auditoría de cambios en estados críticos.

---

## 15) Roadmap

- **V1.0**: CRUD, matching, ranking, chat con candado (básico), fee Stripe, acuerdos mínimos, notificaciones, inactividad.
- **V1.1**: KYC (INE/CURP), geolocalización real, `distance` por geohash, `PATCH` completos, reseñas y baja automática.
- **V1.2**: Mensajería en tiempo real, pagos destacados $49 MXN, marketplace de materiales (exploratorio).

---

## 16) Apéndice — Snippets útiles

### 16.1 Ejemplo `fetch` (UTF-8)

```ts
await fetch("/api/requests", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ title: "Instalación eléctrica", city: "Monterrey" }),
});
```

### 16.2 Índice de ranking SQL (referencia)

```sql
-- ejemplo de ORDER BY con nulls last
select * from profiles
where active = true
order by is_featured desc, rating desc nulls last, last_active_at desc
limit 20;
```

## UX / Navegación por roles (Header & CTAs)

### Objetivo

Controlar qué botones aparecen en la barra superior según **estado de sesión** y **rol** del usuario (visitante, cliente/solicitante, profesional, administrador), para guiar acciones principales sin confundir.

### Estados y reglas

#### 1) Visitante (no autenticado)

- **Izquierda:** Logo Handi (link a `/`).
- **Derecha (CTAs):**
  - **Iniciar sesión** → `/auth/sign-in`
    - _Regla:_ tras autenticar, este botón se reemplaza por **avatar de perfil** con menú.
  - **Postúlate como profesional** → `/apply/professional`
- _Regla global:_ estos dos botones **no se muestran** cuando el usuario ya inició sesión.

#### 2) Autenticado — Cliente/Solicitante (`role = "client"`)

- **Izquierda:** Logo Handi → `/dashboard`
- **Derecha (solo cliente):**
  - **Publicar solicitud** → `/requests/new`
  - **Mis solicitudes** → `/requests`
  - **Buscar profesionales** → `/professionals`
- **Avatar** (dropdown): **Mi perfil** `/me`, **Configuración** `/settings`, **Salir** `/auth/sign-out`

#### 3) Autenticado — Profesional (`role = "pro"`)

- **Izquierda:** Logo Handi → `/pro/dashboard`
- **Derecha (solo profesional):**
  - **Ver solicitudes** → `/requests/explore`
  - **Mis propuestas** → `/applications`
  - **Mi perfil profesional** → `/pro/profile`
- **Avatar** (dropdown): **Mi perfil** `/me`, **Configuración** `/settings`, **Salir** `/auth/sign-out`

#### 4) Autenticado — Administrador (`role = "admin"`)

- **Izquierda:** Logo Handi → `/admin`
- **Derecha (solo admin):**
  - **Panel** → `/admin`
  - **Usuarios** → `/admin/users`
  - **Solicitudes** → `/admin/requests`
  - **Profesionales** → `/admin/professionals`
- **Avatar** (dropdown): **Mi perfil** `/me`, **Configuración** `/settings`, **Salir** `/auth/sign-out`

### Matriz de visibilidad (resumen)

| Componente / Botón               | Visitante | Cliente | Profesional | Admin |
| -------------------------------- | :-------: | :-----: | :---------: | :---: |
| Logo (izquierda)                 |    ✔     |   ✔    |     ✔      |  ✔   |
| Iniciar sesión                   |    ✔     |   ✖    |     ✖      |  ✖   |
| Postúlate como profesional       |    ✔     |   ✖    |     ✖      |  ✖   |
| Publicar solicitud               |    ✖     |   ✔    |     ✖      |  ✖   |
| Mis solicitudes                  |    ✖     |   ✔    |     ✖      |  ✖   |
| Buscar profesionales             |    ✖     |   ✔    |     ✖      |  ✖   |
| Ver solicitudes                  |    ✖     |   ✖    |     ✔      |  ✖   |
| Mis propuestas                   |    ✖     |   ✖    |     ✔      |  ✖   |
| Mi perfil profesional            |    ✖     |   ✖    |     ✔      |  ✖   |
| Panel admin / Usuarios / etc.    |    ✖     |   ✖    |     ✖      |  ✔   |
| Avatar con menú (perfil/ajustes) |    ✖     |   ✔    |     ✔      |  ✔   |

### Rutas acordadas (App Router)

- **Auth:** `/auth/sign-in`, `/auth/sign-out` (SSR con cookies Supabase).
- **Aplicación profesional:** `/apply/professional`.
- **Cliente:** `/dashboard`, `/requests`, `/requests/new`, `/professionals`.
- **Profesional:** `/pro/dashboard`, `/requests/explore`, `/applications`, `/pro/profile`.
- **Admin:** `/admin`, `/admin/users`, `/admin/requests`, `/admin/professionals`.
- **Comunes:** `/me`, `/settings`.

### Implementación (guía técnica)

- **Fuente de verdad del rol:** columna `role` en `profiles` (valores: `client`, `pro`, `admin`).
- **Carga en server:** en el **layout** compartido (`app/(site)/layout.tsx` o equivalente), obtener sesión y rol con Supabase (SDK server con cookies).
- **Header server component:** leer `{ isAuth, role, avatarUrl }` y renderizar condicionalmente.
- **No confiar en la UI:** RLS y checks en endpoints deben validar permisos por rol.

### Criterios de aceptación (QA)

1. Como **visitante**, veo **Iniciar sesión** y **Postúlate como profesional**; al loguearme, desaparecen y veo **avatar**.
2. Como **cliente**, solo veo botones de **cliente**; no veo botones de **profesional** ni **admin**.
3. Como **profesional**, solo veo botones de **profesional**.
4. Como **admin**, solo veo botones de **admin**.
5. Navegación funciona en desktop y mobile; el menú colapsa en mobile manteniendo la misma matriz de visibilidad.
6. Reglas persisten tras refresh (SSR).

### Notas de diseño (UI)

- Usar **shadcn/ui** (Button, DropdownMenu, Avatar) y Tailwind.
- `NEXT_PUBLIC_APP_URL` define la URL base pública (preferida) para construir URLs absolutas. Como compatibilidad, `NEXT_PUBLIC_SITE_URL` puede servir de fallback. Ver helper `lib/http.ts`.
- Evitar duplicar rutas; usar enlaces declarados arriba.
- Color primario de marca: `#11304A` (para botones/CTAs y elementos primarios). Ver `docs/guia-de-estilos-colores-tipografia.md`.
- Color secundario de marca: `#F9E7C9` (chips, badges y `variant="secondary"`).
