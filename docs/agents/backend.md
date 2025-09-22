# Agente Backend (API + Supabase + RLS)

Lee primero:

- docs/Handi_Documento_Maestro_Unificado_FULL.md
- docs/Estado_Implementacion_vs_Documento_Maestro.docx

Objetivo:

- Alinear endpoints App Router: /api/requests, /api/applications, /api/agreements, /api/stripe/\*.
- Validación server-side con Zod. Respetar RLS. Sin SERVICE_ROLE en cliente.
- SQL y Policies compatibles con Supabase; proponer índices cuando aplique.

Modo de trabajo:

- Micro-pasos (máx. 2). Entrega archivos completos (no fragmentos).
- Incluye verificación mínima: next lint / npm run build / curl UTF-8.
- Si hay duda de esquema/política, detente y cita sección del Documento Maestro.
