# Conversion Events (Launch v1.5)

## Objetivo

Definir conversiones canónicas de alto valor y dejar payloads listos para una futura capa server-side/CAPI sin integrar todavía plataformas externas.

## Conversiones principales

| Evento                | Definición canónica                                      | Dónde se dispara hoy                                                                                      | Tier    |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| `request_created`     | Solicitud creada exitosamente por cliente                | `components/requests/useCreateRequestForm.ts` tras respuesta OK de `/api/requests`                        | Primary |
| `pro_apply_submitted` | Postulación profesional enviada exitosamente             | `app/(site)/(main-site)/pro-apply/pro-apply-form.client.tsx` tras respuesta OK de `/api/pro-applications` | Primary |
| `contact_intent`      | Inicio exitoso de conversación comercial (chat start OK) | Flujos que llaman `/api/chat/start` y reciben `conversation.id`                                           | Primary |

## Acción canónica elegida para `contact_intent`

Se eligió: **inicio exitoso de chat** (`/api/chat/start` con `ok` e `id` de conversación).

Razones:

- Es una acción real y transversal en el producto para contacto cliente-profesional.
- Representa intención comercial más fuerte que clicks de UI sin confirmación.
- Tiene identificador de negocio estable (`conversation_id`) útil para deduplicación futura.
- Ocurre antes del cierre final, ideal para optimizar campañas mid-funnel.

## Payload de conversión estandarizado

Utilidad central:

- `lib/analytics/conversions.ts`

Campos base:

- `conversion_name`
- `conversion_value_tier`
- `conversion_model_version`
- `conversion_transport_ready`
- `event_id`
- `source_page`
- `user_type`
- `request_id`
- `profile_id`
- `conversation_id`
- `service_category`
- `service_subcategory`
- `city`
- `placement`
- `intent_channel` (para `contact_intent`, hoy `chat_start`)

## Event IDs y deduplicación futura

- Se genera `event_id` para conversiones críticas.
- Para `contact_intent` se prioriza un ID estable por conversación:
  - `contact_intent:{conversation_id}`
- `/api/chat/start` ya devuelve:
  - `meta.conversion_event_name`
  - `meta.conversion_event_id`
- Los clientes usan ese `event_id` cuando existe.

Esto deja preparado el camino para dedupe client/server (Meta CAPI, sGTM u otras salidas).

## Readiness server-side (siguiente fase)

Candidatos naturales para emisión server-side:

1. `request_created` desde `POST /api/requests` (source of truth de creación).
2. `pro_apply_submitted` desde `POST /api/pro-applications` (source of truth de postulación).
3. `contact_intent` desde `POST /api/chat/start` (source of truth de conversación).

## Conversión Ads recomendada (launch)

Primary conversion candidates:

- `request_created`
- `pro_apply_submitted`
- `contact_intent` (como signal de intención comercial fuerte)

Microconversiones (no primary):

- `request_create_started`
- `pro_apply_started`
- `professional_profile_viewed`
- `primary_cta_clicked` / `secondary_cta_clicked`
