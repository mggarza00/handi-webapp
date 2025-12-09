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

echo "-> Consultando A-record (IPv4) con 1.1.1.1"
A_IP="$(nslookup -type=A db.${PROJECT_REF}.supabase.co 1.1.1.1 2>/dev/null | awk '/Address: /{print $2}' | tail -n1 || true)"
if [[ -z "$A_IP" ]]; then
  echo "No se obtuvo IPv4. Probando con 8.8.8.8..."
  A_IP="$(nslookup -type=A db.${PROJECT_REF}.supabase.co 8.8.8.8 2>/dev/null | awk '/Address: /{print $2}' | tail -n1 || true)"
fi
if [[ -z "$A_IP" ]]; then
  echo "No hay A-record (IPv4) para db.${PROJECT_REF}.supabase.co." >&2
  echo "Cambia el DNS del adaptador a 1.1.1.1/8.8.8.8 y ejecuta: ipconfig /flushdns" >&2
  exit 1
fi

SUPABASE_DB_URL="postgresql://postgres:${PROJECT_REF}:${DB_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"

echo "-> Probando conexión directa por hostname"
if ! psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "select current_database();" >/dev/null 2>&1; then
  echo "Falla por hostname; reintentando con IPv4 directo: $A_IP"
  SUPABASE_DB_URL="postgresql://postgres:${PROJECT_REF}:${DB_PASS}@${A_IP}:5432/postgres?sslmode=require"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "select current_database();" >/dev/null
fi

echo "-> Ejecutando supabase db push (conexión directa)"
npx -y supabase@latest db push --db-url "$SUPABASE_DB_URL" --debug
echo "OK"

