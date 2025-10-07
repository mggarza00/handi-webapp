# Guía de Migraciones (Supabase)

## Reglas
- Un archivo = un `version` único en formato `YYYYMMDDHHMMSS_descriptivo.sql`.
- Nunca reutilices prefijos (evita múltiples `20250927_*.sql`).
- Usa nombres descriptivos cortos: `create_profiles`, `add_status_check`, etc.

## Flujo normal
```bash
# Crear migración
# a) con diff (local):
supabase db diff -f YYYYMMDDHHMMSS_descripcion
# b) manual: crea el archivo en supabase/migrations con el prefijo único

# Aplicar (local/remoto según tengas link)
supabase db push
```

## Si hay des-sincronización (historial remoto ≠ local)
```bash
# Alinear historial remoto marcando como applied una versión ya existente
# (no re-ejecuta el contenido):
supabase migration repair --status applied <version_existente>

# Si el CLI indica "insertar previas", usa:
supabase db push --include-all
```

## Duplicados por error (varios archivos con la misma versión)
- Renombra cada archivo a timestamps únicos.
- Marca en remoto como applied para no re-ejecutar:
```bash
supabase migration repair --status applied <nuevo_version>
```
- Luego:
```bash
supabase db push --include-all
```

## Limpieza de `requests.status`
- Catálogo válido: `active | scheduled | in_process | finished | canceled`.
- Migración idempotente: `20251007090000_requests_status_cleanup_and_check.sql`.

## Scripts útiles
- `scripts/sb-fix-duplicate-migration-versions-2025-10-06.sh`
- `scripts/supabase-repair-and-push.sh`

```
Verificaciones rápidas

-- Sólo 5 estados
select status, count(*) from public.requests group by 1 order by 1;

-- Constraint activo
select conname, pg_get_constraintdef(c.oid)
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname='public' and t.relname='requests' and c.contype='c';

-- Listado de migraciones
supabase migration list
```

## Hooks/Lint
- Evita que los hooks bloqueen SQL:
  - Agrega `supabase/migrations/` a `.eslintignore`.
  - Deja que los hooks sólo afecten JS/TS.
