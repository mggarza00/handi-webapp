# Campaign Readiness (Launch v1)

## Objetivo

Dejar paginas publicas clave listas como destino de campanas de Google Ads y Meta Ads, con CTA claros, estructura de conversion y tracking de engagement util.

## Destinos recomendados por tipo de trafico

| Pagina                        | Objetivo de trafico                       | CTA principal      | CTA secundario        |
| ----------------------------- | ----------------------------------------- | ------------------ | --------------------- |
| `/`                           | Intencion amplia / marca / discovery      | Solicitar servicio | Ver profesionales     |
| `/professionals`              | Comparacion de oferta y validacion social | Solicitar servicio | Explorar servicios    |
| `/servicios`                  | Intencion por categoria                   | Solicitar servicio | Ver profesionales     |
| `/servicios/[service]`        | Intencion alta por servicio               | Solicitar servicio | Ver profesionales     |
| `/servicios/[service]/[city]` | Intencion alta servicio + ciudad          | Solicitar servicio | Ver profesionales     |
| `/ciudades/[city]`            | Intencion local amplia                    | Solicitar servicio | Ver profesionales     |
| `/profiles/[id]`              | Evaluacion de profesional especifico      | Solicitar servicio | Ver mas profesionales |

## Cambios de conversion implementados

- CTA groups estandarizados en paginas clave con jerarquia principal/secundaria.
- Bloques de confianza reutilizables para reforzar decision arriba de la mitad de la pagina.
- FAQs con interaccion real (acordeon) para resolver objeciones sin contenido inflado.
- Refuerzo en home con banda de conversion adicional despues del hero.
- Refuerzo en perfil publico de profesional con CTA de avance de funnel.

## Eventos de engagement agregados

- `primary_cta_clicked`
- `secondary_cta_clicked`
- `hero_cta_clicked`
- `trust_section_viewed`
- `faq_interacted`

Nota:

- En landings locales se mantiene `local_landing_cta_clicked` como evento semantico principal de negocio.
- Los eventos nuevos sirven para calidad de trafico pagado y optimizacion de creativos/landing.

## Piezas reutilizables nuevas

- `components/seo/CampaignCtaGroup.client.tsx`
- `components/seo/CampaignTrustSection.tsx`
- `components/seo/CampaignFaq.client.tsx`
- `components/analytics/TrustSectionViewTracker.client.tsx`

## Gaps para fase 2

- Testing A/B de copies/jerarquia de CTA por canal y audiencia.
- Segmentacion por ciudad/servicio en variantes de hero para paid.
- Optimizacion por cohortes de source/medium (por ejemplo, ad copy dinamico por UTM).
- Medicion de profundidad de scroll y tiempos de lectura por landing.
