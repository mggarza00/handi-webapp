# Estado de Implementacion vs Documento Maestro - Handi Webapp
<!-- Renombrado desde *_Handee_* a *_Handi_* -->

**Ultima actualizacion:** 2025-09-17 (America/Monterrey)

## Resumen ejecutivo
- `npm run check`, `npm run lint` y `npm run test:unit` pasan; el pipeline local queda en verde con tipado estricto y lint limpio.
- La politica de contacto se evalua en runtime (`lib/safety/policy.ts`), por lo que ofertas y chat redactan dinamicamente datos sensibles; las pruebas de guardia en Vitest quedaron verdes.
- `/api/pro/matches` calcula coincidencias con ciudades/categorias/subcategorias y el panel profesional (`/dashboard`) ahora muestra sugerencias con puntaje y motivos.
- `types/supabase.ts` incorpora `request_photos`; `app/api/photos/metadata/route.ts` deja de depender de `@ts-expect-error` y el webhook de Stripe usa la configuracion soportada por la SDK actual.
- `components/chat/ChatPanel.tsx` y `components/chat/MessageList.tsx` tienen payloads tipados y normalizados; el dashboard deja de ser un mock y muestra informacion real.

---

## Estado contra fases del Documento Maestro

### Fase 1 - Consolidacion basica (23 semanas)
- **Listo** Onboarding profesional en `/pro-apply` y API `POST /api/pro-applications` con bandera `empresa`.
- **Listo** Configuracion y perfil publico: `/profile/setup` escribe en `professionals` y `/profiles/[id]` muestra la ficha con galeria privada.
- **Listo** Chat con candado: contacto filtrado en backend/frontend y politica dinamica en `lib/safety/policy.ts`.
- **Listo** Pagos basicos (Stripe): checkout, webhook y acuerdos sin errores de tipado.
- **Listo** Postulaciones/listados: `/my-requests`, `/applications`, `/requests/[id]/applications` usan filtros y RLS.
- **Listo** Panel profesional: `/dashboard` consume `/api/pro/matches` y muestra datos en vivo.

### Fase 2 - Experiencia completa V1 (46 semanas)
- **Parcial** Adjuntos y galerias: subida y firmado funcionan; falta endurecer validaciones de MIME/tamano y limpieza de borradores.
- **Listo** Matching automatico: RPC `get_prospects_for_request`, API `/api/pro/matches` y panel profesional con ranking y razones.
- **Parcial** Notificaciones: existe `lib/notifications.ts` y rutas de ofertas, pero falta cobertura completa y manejo de reintentos/logs.
- **Listo** Ofertas en chat: tabla `offers`, triggers y UI consolidada (bloqueo optimista + notificaciones).
- **Parcial** Flujos de cierre: acuerdos/ofertas actualizan estados, pero no hay doble confirmacion final ni historial consolidado.
- **Parcial** UI consistente: se actualizo header, dashboards y listado de matches; aun falta centro de ayuda real y unificar formularios largos.

### Fase 3 - Extensiones V1.1+
- **Parcial** Inactividad/KYC ligero: funcion + `pg_cron` listos, falta superficie en UI.
- **Pendiente** Calificaciones y resenas.
- **Pendiente** Paneles completos cliente/pro con metricas avanzadas.
- **Pendiente** Ingresos adicionales (destacados pagados, publicidad administrable).

---

## Aspectos tecnicos relevantes

### Supabase / Datos
- `supabase/migrations/20250915110000_offers_chat.sql` mantiene `offers` + trigger de sincronizacion en chat.
- `supabase/migrations/20250916104000_api_rate_limit.sql` sigue habilitando `api_events`; la capa de rate limiting se usa en ofertas.
- `types/supabase.ts` incluye `request_photos`, evitando el `@ts-expect-error` en `app/api/photos/metadata/route.ts`.

### API App Router
- `app/api/auth/sync/route.ts` normaliza la sesion (`session?.user`) sin acceder a propiedades inexistentes.
- `app/api/photos/metadata/route.ts` inserta metadatos tipados y firma URLs sin comentarios forzados.
- `app/api/stripe/webhook/route.ts` usa la configuracion por defecto del SDK (sin API version invalida).
- `app/api/pro/matches/route.ts` genera coincidencias ponderadas (ciudad/categoria/subcategorias + recencia) y expone razones.

### Frontend & UX
- `components/chat/ChatPanel.tsx` y `components/chat/MessageList.tsx` normalizan payloads, puntajes y `created_at` seguros.
- `/dashboard` consume la API de matches y muestra tarjetas de resumen + listado de oportunidades con puntaje.
- `app/(app)/auth/callback/route.ts` y `app/api/auth/sync/route.ts` se ajustaron a los tipos generados de Supabase.

### Seguridad y operaciones
- Politica de contacto dinamica evita cachear variables de entorno; Vitest cubre escenarios block/redact.
- Rate limiting (`lib/rate/limit.ts` + `api_events`) queda disponible para extender a rutas sensibles adicionales.

---

## Salud de codigo (comandos)

| Comando            | Estado | Detalle                                               |
| ------------------ | ------ | ----------------------------------------------------- |
| `npm run check`    | OK     | TypeScript + ESLint limpios.                          |
| `npm run lint`     | OK     | `next lint` + `stylelint` sin advertencias.           |
| `npm run test:unit`| OK     | Vitest (`contact-guard`, `offer-guard`, lock ofertas).|

---

## Riesgos y pendientes prioritarios
- Validar el ranking de `/api/pro/matches` con datos reales (escenarios de multiples ciudades/subcategorias).
- Completar el flujo de cierre (doble confirmacion y estados finales) para solicitudes/acuerdos.
- Ampliar la cobertura de notificaciones y logging (reintentos, alertas) conforme al Documento Maestro.

## Proximos pasos sugeridos
1. Agregar pruebas (unitarias/E2E) que cubran `/api/pro/matches` y el dashboard profesional.
2. Completar la automatizacion de cierre (confirmaciones "completed" y vistas de historial).
3. Extender la capa de rate limiting/notificaciones a rutas sensibles restantes (`/api/chat/send`, `/api/requests/*`).

---

## Backlog complementario
- Endurecer validaciones de adjuntos (MIME, tamano y limpieza de borradores).
- Ejecutar `npm run smoke` y `npm run test:e2e` con datos seed cuando esten disponibles.
- Documentar la cobertura de notificaciones y matching en `docs/api_e2e_rest.http` y guias internas.
