#!/usr/bin/env bash
set -euo pipefail

echo "== Handee | Push de migraciones locales -> REMOTO (Supabase Cloud) =="

# --- CONFIG REQUERIDA ---
PROJECT_REF="hdbzgaqqdpdklntfxapi"
HOST="aws-0-us-east-2.pooler.supabase.com"
PORT="6543"
DBNAME="postgres"
USER="postgres.${PROJECT_REF}"
# ------------------------

# 0) Sanity
test -d supabase/migrations || { echo "❌ No encuentro supabase/migrations. Aborta."; exit 1; }

# 1) Migraciones locales
mapfile -t LOCAL_FILES < <(ls -1 supabase/migrations/*.sql 2>/dev/null | sort -u)
echo "→ Migraciones locales: ${#LOCAL_FILES[@]}"

# 1.1 versiones locales (prefijo YYYYMMDDhhmmss)
mapfile -t LOCAL_VERS < <(printf '%s\n' "${LOCAL_FILES[@]}" | sed -E 's#.*/([0-9]{14})_.*#\1#' | sort -u)

# 2) DB_PASS (Project Password: Dashboard → Settings → Database)
read -s -p "��� Ingresa tu Project Password (DB): " DB_PASS
echo

DB_URL="postgresql://${USER}:${DB_PASS}@${HOST}:${PORT}/${DBNAME}?sslmode=require"

# 3) Probar conexión
echo "→ Probar conexión (select 1)…"
PGPASSWORD="$DB_PASS" psql \
  --host="$HOST" --port="$PORT" --username="$USER" --dbname="$DBNAME" \
  -t -A -c "select 1;" >/dev/null

# 4) Estado ANTES del push
echo "→ Migraciones aplicadas (ANTES):"
PGPASSWORD="$DB_PASS" psql \
  --host="$HOST" --port="$PORT" --username="$USER" --dbname="$DBNAME" \
  -c "select version, name, inserted_at from supabase_migrations.schema_migrations order by version;" || true

# 5) Push remoto (aplica faltantes en orden)
echo "→ supabase db push (REMOTE)…"
npx -y supabase@latest db push --db-url "$DB_URL" --debug

# 6) Estado DESPUÉS del push
echo "→ Migraciones aplicadas (DESPUÉS):"
PGPASSWORD="$DB_PASS" psql \
  --host="$HOST" --port="$PORT" --username="$USER" --dbname="$DBNAME" \
  -c "select version, name, inserted_at from supabase_migrations.schema_migrations order by version;"

# 7) Comparación local vs remoto
echo "→ Comparando versiones locales vs remoto…"
mapfile -t REMOTE_VERS < <(
  PGPASSWORD="$DB_PASS" psql \
    --host="$HOST" --port="$PORT" --username="$USER" --dbname="$DBNAME" \
    -t -A -c "select version from supabase_migrations.schema_migrations order by version;" \
  | sed -e 's/[[:space:]]//g' -e '/^$/d'
)

declare -A REMOTE_SET=()
for v in "${REMOTE_VERS[@]}"; do
  REMOTE_SET["$v"]=1
done

MISSING=()
for v in "${LOCAL_VERS[@]}"; do
  if [[ -z "${REMOTE_SET[$v]+x}" ]]; then
    MISSING+=("$v")
  fi
done

if (( ${#MISSING[@]} == 0 )); then
  echo "✅ Todo aplicado. No hay migraciones locales pendientes en el remoto."
else
  echo "⚠️ Migraciones locales que NO aparecen en remoto:"
  for v in "${MISSING[@]}"; do
    shopt -s nullglob
    files=(supabase/migrations/"${v}"_*.sql)
    shopt -u nullglob
    echo "  - $v ($(basename "${files[0]:-archivo no encontrado}"))"
  done
  echo "Sugerencia: revisa los logs del 'supabase db push --debug' arriba; alguna migración pudo fallar."
fi

echo "== DONE =="
