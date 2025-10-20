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

HOST="db.${PROJECT_REF}.supabase.co"

echo "-> Resolviendo AAAA (IPv6) para ${HOST}"
get_ipv6() {
  local dns="$1"
  # nslookup imprime varias líneas; filtramos Address: que NO sea el propio servidor
  nslookup -type=AAAA "${HOST}" "${dns}" 2>/dev/null \
    | awk '/Address: /{print $2}' \
    | grep -iE '^[0-9a-f:]+$' \
    | tail -n1
}

AAAA_IP="$(get_ipv6 1.1.1.1)"
[[ -z "${AAAA_IP}" ]] && AAAA_IP="$(get_ipv6 2606:4700:4700::1111 || true)"
[[ -z "${AAAA_IP}" ]] && AAAA_IP="$(get_ipv6 8.8.8.8 || true)"
[[ -z "${AAAA_IP}" ]] && AAAA_IP="$(get_ipv6 2001:4860:4860::8888 || true)"

if [[ -z "${AAAA_IP}" ]]; then
  echo "No se pudo obtener la AAAA (IPv6) de ${HOST}. Revisa DNS/Firewall/VPN." >&2
  exit 1
fi

echo "-> AAAA detectada: ${AAAA_IP}"

# IMPORTANTE: IPv6 literal debe ir ENTRE CORCHETES en la URL
export SUPABASE_DB_URL="postgresql://postgres:${PROJECT_REF}:${DB_PASS}@[${AAAA_IP}]:5432/postgres?sslmode=require"

echo "-> Probando conexión IPv6 con psql"
psql -v ON_ERROR_STOP=1 -c "select current_database();" "$SUPABASE_DB_URL" >/dev/null

echo "-> Ejecutando supabase db push (IPv6 directo)"
npx -y supabase@latest db push --db-url "$SUPABASE_DB_URL" --debug
echo "OK"
echo "Cómo ejecutar: npm run db:push:ipv6"
echo "AAAA detectada: ${AAAA_IP}"
echo "Si falla, revisa firewall/ISP/VPN para tráfico IPv6 saliente en 5432."
