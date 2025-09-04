Actúa como par-programmer en este repo. Lee primero:
- docs/Handee_Documento_Maestro_Unificado_FULL.md
- docs/Estado_Implementacion_vs_Documento_Maestro.docx

Usa el Documento Maestro como FUENTE DE VERDAD para:
- Next.js 14 App Router (SSR con cookies de Supabase).
- Endpoints: /api/requests, /api/applications, /api/agreements, /api/stripe/*.
- Validación server-side con Zod. Respetar RLS. No exponer SERVICE_ROLE en cliente.
- Convención global: Content-Type: application/json; charset=utf-8.

Tarea 1 (prioridad): audita /api/requests (GET/POST) contra el Documento Maestro.
- Señala desalineaciones (inputs, outputs, status codes, validaciones).
- Propón micro-pasos concretos (máx. 2 por iteración) con diffs o archivos completos.
- Tras cada cambio, sugiere verificación mínima (next lint / npm run build y curl UTF-8).
- Si falta info, asume el mínimo seguro y detente para confirmar.

Si detectas rutas duplicadas, claves en cliente, o incumplimiento de RLS, detente y propón fix seguro.
