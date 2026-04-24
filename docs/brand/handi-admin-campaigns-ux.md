# Handi Admin Campaigns UX

## Objetivo

Reducir carga cognitiva en el admin de campañas sin eliminar capacidades operativas del Campaign OS.

## Estructura nueva

`/admin/campaigns/[id]` ahora separa la revisión por dominios:

- `Overview`
  - estado editorial
  - publish status
  - visual readiness global
  - next best action
  - warnings críticos
  - summary, strategy, QA, ownership y checklist
- `Copy`
  - variantes por canal
  - edición/regeneración/decision support
  - QA, rationale, metadata y versiones detrás de elementos colapsables
- `Creativos`
  - jobs visuales, assets y derivados
- `Export / Handoff`
  - creative bundles
  - placements
  - publishing
  - publish history
- `Analytics`
  - performance, trends y recommendations
- `Activity`
  - notas internas
  - activity feed

## Criterios de priorización

- Mostrar primero estado, blockers y acción siguiente.
- Mantener metadata avanzada accesible, pero no visible por defecto.
- Evitar que copy, creativos, exports y analytics compitan por atención en la misma vista.
- Mantener acciones principales cerca del dominio donde se usan.

## Lista de campañas

`/admin/campaigns` se simplifica a una cola operativa:

- campaña y contexto básico
- status editorial/publicación
- readiness compacto
- owner
- última actividad

Las señales secundarias se mantienen como badges y hints, no como columnas primarias.

## Limitaciones actuales

- El detalle sigue siendo un server component grande; la separación por tabs ya reduce densidad, pero aún hay margen para extraer más paneles por dominio.
- El handoff y analytics siguen siendo tabs densos por naturaleza; en futuras iteraciones conviene colapsar más metadata técnica dentro de esos dominios.
