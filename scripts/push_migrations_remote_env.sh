#!/usr/bin/env bash
set -euo pipefail

echo "== Handi | Push de migraciones locales -> REMOTO (Supabase Cloud) =="

# Config del proyecto (coincide con .supabase/config.toml y script original)
PROJECT_REF="hdbzgaqqdpdklntfxapi"
HOST="aws-0-us-east-2.pooler.supabase.com"
PORT="6543"
DBNAME="postgres"
USER="postgres.${PROJECT_REF}"

test -d supabase/migrations || { echo "❌ No encuentro supabase/migrations. Aborta."; exit 1; }

if [[ -z "${DB_PASS:-}" ]]; then
  read -s -p "🔐 Ingresa tu Project Password (DB): " DB_PASS
  echo
else
  echo "→ Usando DB_PASS desde entorno"
fi

DB_URL="postgresql://${USER}:${DB_PASS}@${HOST}:${PORT}/${DBNAME}?sslmode=require"

echo "→ Aplicando migraciones con Supabase CLI…"
npx -y supabase@latest db push --db-url "$DB_URL" --debug

echo "✅ Migraciones aplicadas"
echo "== DONE =="

