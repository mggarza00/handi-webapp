# Página de perfil público – Secciones nuevas

Este directorio contiene los componentes server/client usados en la sección "Experiencia" de la página pública de perfil de profesionales.

- `ReviewsCarousel.tsx` (Server) + `ReviewsCarousel.client.tsx` (Client):
  - SSR de la primera página desde `/api/professionals/:id/reviews`.
  - Carga incremental con IntersectionObserver.
  - Tarjetas con Avatar, nombre, estrellas, fecha y comentario truncado.

- `JobHistoryGrid.tsx` (Server) + `JobHistoryGrid.client.tsx` (Client):
  - SSR de la primera página desde `/api/professionals/:id/jobs`.
  - Grid de tarjetas por solicitud con galería (hasta 5 imágenes) y lightbox.
  - Paginación con botón "Cargar más".

Utilitarios globales:

- `components/StarRating.tsx`: estrellas de solo lectura.
- `components/Carousel.tsx`: contenedor con scroll horizontal + snap.

Cache y revalidate:

- Los fetch SSR usan `next.tags = ["profile:<id>"]`.
- Los POST relevantes invalidan con `revalidateTag("profile:<id>")`.

## Capturas

Agrega aquí capturas de la sección en mobile/desktop cuando pruebes localmente.

