#!/usr/bin/env bash
set -euo pipefail

# Asegúrate de haber hecho 'supabase link' al proyecto correcto antes de correr esto
# Requiere supabase CLI autenticado.

echo "==> Reparando historial de migraciones en remoto según lista"

# Primero el 'reverted' indicado por Supabase CLI
supabase migration repair --status reverted 20250907 || true

# Ahora marcamos como 'applied' todas las migraciones válidas con timestamp completo
# (Omitimos las abreviadas que el CLI no acepta)
APPLIED_IDS=(
  20250907090000
  20250907090500
  20250907091000
  20250912090000
  20250912090500
  20250912091000
  20250912100000
  20250912102000
  20250912103000
  20250912103500
  20250912104000
  20250912104100
  20250912104500
  20250915110000
  20250916103000
  20250916104000
  20250918042029
  20250918043327
  20250918101000
  20250918102500
  20250922000100
  20250922001000
  20250922001500
  20250922012000
  20250922013000
  20250922020000
  20250922021000
  20250922021500
  20250922170000
  20250922172500
  20250926121500
  20250926130000
  20250926133000
  20250929120000
  20250929123000
  20250929140500
  20251001110000
  20251001111500
  20251003140500
  20251006120000
  20251007090000
)

is_full_ts() {
  [[ "$1" =~ ^[0-9]{14}$ ]]
}

for id in "${APPLIED_IDS[@]}"; do
  if is_full_ts "$id"; then
    echo "   - apply $id"
    supabase migration repair --status applied "$id" || true
  else
    echo "   - omitido (abreviado/no válido p/CLI): $id"
  fi
done

echo "==> Historial reparado. Aplicando migraciones locales"
supabase db push

echo "==> Verificando CHECK de 'requests.status' (si psql está disponible)"
if command -v psql >/dev/null 2>&1 && [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  psql "${SUPABASE_DB_URL}" -qc "\d+ public.requests" || true
else
  echo "(psql no disponible o SUPABASE_DB_URL no definido; omito verificación)"
fi

echo "==> Done."

