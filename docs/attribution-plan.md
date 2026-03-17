# Attribution Plan (Launch v1)

## Objetivo

Capturar parametros de adquisicion (UTMs/click IDs), persistir primer y ultimo toque, y adjuntarlos automaticamente a eventos de negocio en `dataLayer`.

## Parametros capturados

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `utm_id`
- `gclid`
- `fbclid`
- `msclkid`
- `ttclid`

## Modelo implementado

- `first_touch`: primer set de parametros valido detectado en la sesion del navegador.
- `last_touch`: ultimo set de parametros valido detectado.
- Si una URL no trae parametros de adquisicion, no sobrescribe el estado actual.

## Persistencia

- LocalStorage:
  - key: `handi_attribution_v1`
- Cookies espejo (para lectura futura server-side si se requiere):
  - `handi_attr_ft`
  - `handi_attr_lt`
- Duracion cookies: 90 dias (`SameSite=Lax`, `Path=/`).

## Integracion tecnica

- Captura global en cliente:
  - `components/analytics/AttributionCapture.client.tsx`
  - Montado en `app/layout.tsx`
  - Ejecuta captura en carga inicial y cambios de ruta/query
- Utilidad central:
  - `lib/analytics/attribution.ts`
- Enriquecimiento automatico de eventos:
  - `lib/analytics/track.ts` agrega payload de atribucion a todos los `trackEvent`

## Campos enviados en eventos

Se adjuntan prefijos por toque:

- `attribution_first_*`
- `attribution_last_*`

Ejemplos:

- `attribution_first_utm_source`
- `attribution_last_gclid`
- `attribution_first_captured_at`
- `attribution_last_landing_path`

## Eventos clave cubiertos

Todos los eventos que usan `trackEvent` quedan enriquecidos automaticamente, incluyendo:

- `sign_up_completed`
- `login_completed`
- `request_create_started`
- `request_created`
- `pro_apply_started`
- `pro_apply_submitted`
- `professional_profile_viewed`
- `local_landing_cta_clicked`
- `role_switched`

## Decision sobre propagacion de UTMs en CTAs

En fase 1 no se propagan UTMs manualmente en cada link interno.
Se persisten al entrar y se adjuntan via storage en eventos clave para evitar URLs internas ruidosas.

## Limitaciones fase 1

- Sin deduplicacion cross-device.
- Sin atribucion server-side/cookie ingestion en backend.
- Sin modelo multi-touch avanzado.
- Sin CAPI/Offline conversions (fase 2).
