#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="hdbzgaqqdpdklntfxapi"

if [[ ! -f ".env.local" ]]; then
  echo ".env.local no encontrado. Debe contener DB_PASS=..." >&2
  exit 1
fi
DB_PASS="$(grep -E '^DB_PASS=' .env.local | cut -d'=' -f2- || true)"
if [[ -z "${DB_PASS:-}" ]]; then
  echo "DB_PASS vacío o no definido en .env.local" >&2
  exit 1
fi

POOLER_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASS}@aws-0-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require"

echo "-> Probar conectividad pooler"
psql "$POOLER_URL" -v ON_ERROR_STOP=1 -c "select 1;" >/dev/null

echo "-> Aplicando migración de la vista (v_receipt_pdf)"
psql "$POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20251008161500_v_receipt_pdf.sql
echo "OK"

