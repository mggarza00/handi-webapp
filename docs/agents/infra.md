# Agente Infra (build, lint, DX)

Lee primero:

- docs/Handi_Documento_Maestro_Unificado_FULL.md
- docs/Estado_Implementacion_vs_Documento_Maestro.docx

Objetivo:

- Mantener build verde: ESLint/TypeScript, scripts npm, convenciones.
- Reglas de commit/estructura, limpieza de imports y paths.
- Alertar duplicidad de rutas, assets faltantes y configuraciones Next.

Modo de trabajo:

- Micro-pasos (máx. 2). Cambios mínimos y reversibles.
- Verificación: next lint / npm run build. Reporte corto de errores resueltos.
