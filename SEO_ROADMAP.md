# SEO Roadmap - Expansion Local Handi

## Objetivo

Escalar captacion organica transaccional para servicios del hogar, empezando por Nuevo Leon (Monterrey y San Pedro) y expandiendo por servicio + ciudad.

## 1) Fase siguiente (30-45 dias)

1. Expandir combinaciones high-intent:
   - `plomero`, `electricista`, `limpieza`, `carpintero`, `jardinero`, `mozo`
   - ciudades: Monterrey, San Pedro Garza Garcia, Guadalupe, Apodaca, Santa Catarina, San Nicolas.
2. Crear enlazado cruzado contextual:
   - desde `/professionals` hacia landings locales por servicio/ciudad.
   - desde perfiles pro hacia servicio+ciudad correspondiente.
3. Añadir bloques de prueba social real:
   - snippets de resenas verificadas por servicio/ciudad.
4. Medir conversion por landing:
   - impression -> click CTA -> sign-in -> request_created.

## 2) Arquitectura de expansion recomendada

- Mantener convención principal:
  - `/servicios/[service]`
  - `/servicios/[service]/[city]`
  - `/ciudades/[city]`
- Usar `lib/seo/local-landings.ts` como fuente única:
  - servicios
  - ciudades
  - zonas
  - combinaciones activas y prioridad
- Agregar solo combinaciones con evidencia de demanda para evitar thin content.

## 3) Siguientes landings sugeridas

- plomero en guadalupe
- electricista en guadalupe
- limpieza en san-pedro-garza-garcia
- carpintero en san-pedro-garza-garcia
- jardinero en san-pedro-garza-garcia
- plomero en apodaca
- electricista en san-nicolas

## 4) Quick wins

1. Incluir enlaces locales en footer o navegacion secundaria hacia hubs (`/servicios`, `/ciudades`).
2. Agregar modulos de "servicios relacionados" en cada landing servicio+ciudad.
3. Generar snippets de FAQ con preguntas reales de soporte/comercial.
4. Enriquecer schema Service con datos de oferta/disponibilidad cuando exista fuente confiable.
5. Revisar titles/meta en `/professionals` para incluir variante local cuando haya filtros por ciudad.

## 5) Criterios de calidad para nuevas landings

- Metadata unica y no plantillada en exceso.
- H1 claro + copy local util (sin keyword stuffing).
- Zonas atendidas reales.
- FAQ util y consistente con contenido visible.
- CTA alineado con auth y flujo real.
- Links internos bidireccionales (hubs <-> landings).

## 6) Riesgos a controlar

- Duplicacion semantica entre servicios similares.
- Crecimiento masivo sin demanda (thin content).
- Canonical incorrecta al introducir aliases.
- Desalineacion entre schema y contenido visible.

## Prioridad siguiente para Monterrey/San Pedro

1. Publicar las siguientes combinaciones inmediatas en orden de impacto:
   - `plomero-san-pedro-garza-garcia`
   - `electricista-san-pedro-garza-garcia`
   - `limpieza-san-pedro-garza-garcia`
   - `jardinero-monterrey`
   - `mozo-monterrey`
2. Reforzar enlazado interno desde:
   - `/professionals` (bloque por ciudad+servicio)
   - `/categorias` (puentes a rutas locales de alta demanda)
   - home (`/`) con links visibles por keyword local.
3. Definir contenido diferencial por colonia:
   - Monterrey: Cumbres, Contry, Mitras, Obispado
   - San Pedro: Del Valle, Valle Oriente, Lomas del Valle
4. Instrumentar medicion de calidad por landing:
   - CTR organico en Search Console
   - click en CTA local
   - `auth_before_request` -> `request_new` -> `request_created`
5. Consolidar snippets de confianza reales:
   - reseñas verificadas por servicio y ciudad
   - tiempos de respuesta promedio por zona (si hay datos confiables).
