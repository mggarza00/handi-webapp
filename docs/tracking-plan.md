# Tracking Plan (Launch v1)

## Objetivo

Primera capa de medicion para lanzamiento usando GTM ya cargado globalmente.  
Los eventos se empujan a `window.dataLayer` y se pueden mapear en GTM hacia GA4, Google Ads y Meta.

## Capa tecnica

- Utilidad central: `lib/analytics/track.ts`
- Atribucion UTM/click IDs: `lib/analytics/attribution.ts` (captura first/last touch)
- Payloads de conversion: `lib/analytics/conversions.ts`
- API base:
  - `trackEvent(name, params)`
  - Helpers semanticos para eventos clave del funnel
- Seguridad:
  - Solo corre en browser
  - No truena si `dataLayer` no existe
  - Falla silenciosa por diseno

## Atribucion

- La captura se ejecuta globalmente con `components/analytics/AttributionCapture.client.tsx` montado en `app/layout.tsx`.
- `trackEvent` adjunta automaticamente parametros `attribution_first_*` y `attribution_last_*` cuando existen.
- Detalle del modelo en `docs/attribution-plan.md`.

## Eventos implementados

| Evento                        | Donde se dispara                                                                                                                    | Parametros principales                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `sign_up_started`             | `components/auth/useEmailPasswordAuth.ts` (antes de `signUp` email/password)                                                        | `method`, `source_page`                                                                                              |
| `sign_up_completed`           | `components/auth/useEmailPasswordAuth.ts` (signup exitoso)                                                                          | `method`, `user_type`, `source_page`, `pending_email_confirmation`                                                   |
| `login_completed`             | `components/auth/useEmailPasswordAuth.ts` (login email/password exitoso) y `components/auth/SignInFlow.client.tsx` (callback OAuth) | `method`, `user_type`, `source_page`                                                                                 |
| `request_create_started`      | `app/_components/HowToUseHandiSection.client.tsx` (CTA) y `components/requests/useCreateRequestForm.ts` (primer submit)             | `source_page`, `user_type`                                                                                           |
| `request_created`             | `components/requests/useCreateRequestForm.ts` (respuesta OK de `/api/requests`)                                                     | `request_id`, `service_category`, `service_subcategory`, `city`, `source_page`, `user_type`                          |
| `professional_profile_viewed` | `app/(site)/(main-site)/profiles/[id]/page.tsx` via `components/analytics/ProfessionalProfileViewTracker.client.tsx`                | `profile_id`, `source_page`, `user_type`                                                                             |
| `pro_apply_started`           | `app/_components/HowToUseHandiSection.client.tsx` (CTA) y `app/(site)/(main-site)/pro-apply/pro-apply-form.client.tsx` (mount)      | `source_page`, `user_type`                                                                                           |
| `pro_apply_submitted`         | `app/(site)/(main-site)/pro-apply/pro-apply-form.client.tsx` (respuesta OK de `/api/pro-applications`)                              | `source_page`, `user_type`, `service_category`, `city`                                                               |
| `contact_intent`              | inicio exitoso de conversacion (`/api/chat/start`) en request detail, request explore, listados y botones de chat                   | `event_id`, `request_id`, `profile_id`, `conversation_id`, `placement`, `intent_channel`, `source_page`, `user_type` |
| `role_switched`               | `components/UserTypeInfo.client.tsx` y `components/ActiveUserTypeSwitcher.client.tsx` (switch exitoso)                              | `source_page`, `origin_role`, `destination_role`                                                                     |
| `local_landing_viewed`        | landings SEO locales (`/servicios/[service]`, `/servicios/[service]/[city]`, `/ciudades/[city]`) via tracker client                 | `landing_type`, `service_slug`, `city_slug`, `source_page`                                                           |
| `local_landing_cta_clicked`   | CTA principal de landings locales                                                                                                   | `landing_type`, `service_slug`, `city_slug`, `cta_type`, `source_page`                                               |
| `primary_cta_clicked`         | CTA principal en home, `/professionals`, `/servicios`, `/ciudades` y `/profiles/[id]`                                               | `page_type`, `placement`, `cta_label`, `cta_target`, `service_slug`, `city_slug`, `profile_id`, `source_page`        |
| `secondary_cta_clicked`       | CTA secundario en pages de adquisicion                                                                                              | `page_type`, `placement`, `cta_label`, `cta_target`, `service_slug`, `city_slug`, `profile_id`, `source_page`        |
| `hero_cta_clicked`            | CTA del hero cliente en home                                                                                                        | `page_type`, `placement`, `cta_label`, `cta_target`, `source_page`, `user_type`                                      |
| `trust_section_viewed`        | Bloques de confianza en paginas de adquisicion                                                                                      | `page_type`, `section_id`, `service_slug`, `city_slug`, `source_page`                                                |
| `faq_interacted`              | Interaccion con FAQ acordeon en landings                                                                                            | `page_type`, `faq_id`, `faq_question`, `service_slug`, `city_slug`, `source_page`                                    |

## Conversiones recomendadas (launch)

- Primarias:
  - `request_created`
  - `pro_apply_submitted`
  - `sign_up_completed`
  - `contact_intent`
- Microconversiones:
  - `request_create_started`
  - `pro_apply_started`
  - `professional_profile_viewed`
  - `login_completed`
  - `role_switched`

## Mapeo recomendado en GTM / Ads

- GA4:
  - Crear triggers por `event` en dataLayer
  - Enviar parametros tal cual a eventos GA4
- Google Ads:
  - Usar conversion linker + tags de conversion sobre eventos primarios
  - Mantener IDs/labels en GTM (no hardcodeados en app)
- Meta Ads:
  - Mapear eventos de negocio en GTM (Pixel) como:
    - `request_created` -> `Lead` (o evento custom)
    - `pro_apply_submitted` -> `CompleteRegistration` (o custom)
  - CAPI queda para fase 2

## Pendientes fase 2

- `contact_intent` (definir accion de contacto unica y consistente)
- Deduplicacion avanzada entre canales (GA4/Ads/Meta)
- Server-side tracking/CAPI para eventos criticos de pago y cierre de acuerdos
- QA con DebugView (GA4), Tag Assistant y Pixel Helper por flujo E2E
