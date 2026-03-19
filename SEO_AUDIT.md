# SEO Audit - Handi Webapp

## 1) Estado SEO encontrado (antes de esta implementacion)

- Ya existia base tecnica:
  - `app/layout.tsx` con metadata global, Organization y WebSite JSON-LD.
  - `app/robots.ts` y `app/sitemap.ts` funcionales.
  - rutas publicas SEO en:
    - `/servicios`
    - `/ciudades`
    - `/servicios/[service]`
    - `/servicios/[service]/[city]`
    - `/ciudades/[city]`
- Ya existia `generateMetadata` en landings locales y JSON-LD basico por pagina.
- Ya existia tracking de interacciones locales (`local_landing_cta_clicked`).

## 2) Gaps detectados

- Keyword targeting local insuficiente para intencion transaccional:
  - faltaban slugs y contenido explicito para `plomero`, `electricista`, `jardinero`, `carpintero`, `limpieza`, `mozo`.
- Metadata y copy demasiado generales en varias rutas.
- Hubs con poco contexto local (zonas atendidas, problemas comunes, FAQ local).
- Enlazado interno local limitado desde home y hubs principales.
- Robots no bloqueaba explicitamente rutas de campana (`/landing`).
- CTA principal local podia intentar abrir flujo de solicitud sin sesion (friccion + UX frágil).

## 3) Riesgos SEO observados

- Riesgo de thin content en combinaciones servicio+ciudad si no se ancla contenido local real.
- Riesgo de canibalizacion entre landings genericas (`plomeria` vs `plomero`) sin normalizacion de slugs.
- Riesgo de señal mixta de conversion al mezclar CTA de solicitud sin auth previa.

## 4) Cambios implementados en esta fase

### Arquitectura de datos SEO local

- Se reforzo `lib/seo/local-landings.ts` como fuente de verdad con:
  - servicios orientados a keyword transaccional local (`plomero`, `electricista`, `jardinero`, `carpintero`, `limpieza`, `mozo`).
  - campos para contenido util: `benefits`, `commonIssues`.
  - ciudades con `zones` para copy local indexable.
  - combinaciones activas priorizadas para Monterrey y San Pedro.
  - alias de slugs legacy (`plomeria` -> `plomero`, etc.) para compatibilidad.

### Landings/hubs

- `/servicios`: indice limpio + busquedas locales populares con enlaces internos.
- `/ciudades`: indice limpio + rutas locales destacadas.
- `/servicios/[service]`: hub sobrio con ciudades disponibles + problemas comunes del servicio.
- `/servicios/[service]/[city]`: landing de alta intencion con:
  - H1 y copy local
  - beneficios
  - zonas atendidas
  - problemas frecuentes
  - FAQ visible
  - FAQPage JSON-LD
  - CTA integrado y no dominante
- `/ciudades/[city]`: hub de servicios por ciudad + FAQ local (con schema).

### SEO tecnico

- Metadata global mejorada en `app/layout.tsx` con foco local (Monterrey/San Pedro).
- Organization JSON-LD reforzado con `areaServed`.
- WebSite JSON-LD con `SearchAction`.
- `robots.ts`: se agrega bloqueo de `/landing`.
- `sitemap.ts`: prioridad reforzada para hubs y combinaciones locales segun prioridad.

### Conversion/UX SEO

- CTA local ahora depende de sesion en `components/seo/LocalLandingCtas.client.tsx`:
  - con sesion: abre flujo real de solicitud
  - sin sesion: va a sign-in con `next` a la URL local actual
- Tracking diferenciado:
  - `request_new`
  - `auth_before_request`

## 5) Paginas indexables clave despues de cambios

- `/`
- `/servicios`
- `/ciudades`
- `/servicios/[service]`
- `/servicios/[service]/[city]`
- `/ciudades/[city]`
- `/professionals`
- `/profiles/[id]` (profesionales activos)

## 6) Pendientes recomendados

- Crear clusters adicionales por servicio+ciudad (fase 2) con evidencia real de demanda.
- Incorporar datos reales de conversion por landing (CTR, start rate, request created).
- Reforzar E-E-A-T con contenido operacional real (SLA, politicas, cobertura por colonia basada en datos).
- Validar schema con Rich Results Test para cada plantilla.
- Definir estrategia de enlaces desde blog/centro de ayuda hacia rutas locales prioritarias.

## Riesgos SEO restantes

- Riesgo de similitud entre landings servicio+ciudad al escalar mas combinaciones:
  es importante seguir incorporando variaciones reales por ciudad (zonas, problemas mas reportados, tiempos de atencion).
- Riesgo de desalineacion entre demanda real y contenido publicado:
  no habilitar nuevas combinaciones sin respaldo comercial/operativo para evitar thin content.
- Riesgo de canibalizacion por aliases legacy:
  mantener canonical siempre en slug objetivo (`plomero`, `electricista`, `limpieza`) y evitar abrir rutas alternas indexables.
- Riesgo de sobreindexacion de paginas de campaña:
  se marcaron `/landing/*` como noindex, pero cualquier nueva landing paid debe seguir la misma regla por defecto.
- Riesgo de schema invalido en futuras iteraciones:
  cada cambio de copy visible debe reflejarse tambien en FAQ/Service JSON-LD para no romper coherencia semantica.
