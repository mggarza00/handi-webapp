#!/usr/bin/env bash
# NO usamos "set -e" para que la terminal no se cierre con exit!=0
set -u

# --- Cargar env ---
SUPABASE_URL="$(awk -F= '/^NEXT_PUBLIC_SUPABASE_URL=/{sub(/^[^=]*=/,""); gsub(/\r/,""); print}' .env.local 2>/dev/null)"
SUPABASE_URL="${SUPABASE_URL%\"}"; SUPABASE_URL="${SUPABASE_URL#\"}"
SERVICE_ROLE="$(awk -F= '/^SUPABASE_SERVICE_ROLE_KEY=/{sub(/^[^=]*=/,""); gsub(/\r/,""); print}' .env.local 2>/dev/null)"
SERVICE_ROLE="${SERVICE_ROLE%\"}"; SERVICE_ROLE="${SERVICE_ROLE#\"}"

echo "SUPABASE_URL=$SUPABASE_URL"
echo "SERVICE_ROLE length=${#SERVICE_ROLE}"

if [ -z "${SUPABASE_URL:-}" ] || ! echo "$SUPABASE_URL" | grep -qiE '^https?://'; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL inválida en .env.local"
  exit 0
fi
if [ -z "${SERVICE_ROLE:-}" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY vacío en .env.local"
  exit 0
fi

# Helper para extraer IDs con Node sin romper la shell
extract_user_id() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.id||j.user?.id||'')}catch{console.log('')}})"
}
extract_first_id() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d);console.log((a[0]&&a[0].id)||'')}catch{console.log('')}})"
}

TS="$(date +%s)"

# --- 1) Crear usuarios (cliente y pro) ---
CLIENT_JSON="$(
  curl -sS -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "{\"email\":\"client+$TS@handi.test\",\"email_confirm\":true}"
)"
CLIENT_ID="$(printf '%s' "$CLIENT_JSON" | extract_user_id)"
if [ -z "$CLIENT_ID" ]; then
  echo "ERROR creando cliente"; echo "$CLIENT_JSON"
  exit 0
fi
echo "CLIENT_ID=$CLIENT_ID"

PRO_JSON="$(
  curl -sS -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "{\"email\":\"pro+$TS@handi.test\",\"email_confirm\":true}"
)"
PRO_ID="$(printf '%s' "$PRO_JSON" | extract_user_id)"
if [ -z "$PRO_ID" ]; then
  echo "ERROR creando profesional"; echo "$PRO_JSON"
  exit 0
fi
echo "PRO_ID=$PRO_ID"

# --- 2) Insertar request mínimo ---
REQ_JSON="$(
  curl -sS -X POST "$SUPABASE_URL/rest/v1/requests" \
    -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
    -H "Content-Type: application/json; charset=utf-8" -H "Prefer: return=representation" \
    --data "{\"title\":\"Demo request (seed)\",\"description\":\"Semilla CLI\",\"city\":\"Monterrey\",\"category\":\"general\",\"created_by\":\"$CLIENT_ID\"}"
)"
REQUEST_ID="$(printf '%s' "$REQ_JSON" | extract_first_id)"
if [ -z "$REQUEST_ID" ]; then
  echo "ERROR insertando request"; echo "$REQ_JSON"
  exit 0
fi
echo "REQUEST_ID=$REQUEST_ID"

# --- 3) Insertar agreement ---
AGR_JSON="$(
  curl -sS -X POST "$SUPABASE_URL/rest/v1/agreements" \
    -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
    -H "Content-Type: application/json; charset=utf-8" -H "Prefer: return=representation" \
    --data "{\"request_id\":\"$REQUEST_ID\",\"professional_id\":\"$PRO_ID\",\"amount\":50}"
)"
AGREEMENT_ID="$(printf '%s' "$AGR_JSON" | extract_first_id)"
if [ -z "$AGREEMENT_ID" ]; then
  echo "ERROR insertando agreement"; echo "$AGR_JSON"
  exit 0
fi
echo "AGREEMENT_ID=$AGREEMENT_ID"

# --- 4) Mostrar el registro creado ---
curl -sS "$SUPABASE_URL/rest/v1/agreements?id=eq.$AGREEMENT_ID&select=id,status,request_id,professional_id,amount" \
  -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json; charset=utf-8" | cat

# Siempre terminar con exit 0 para no cerrar la terminal de VSCode
exit 0
