#!/usr/bin/env bash
set -euo pipefail

echo "==> Creando/saltando a rama temporal"
git checkout -b chore/sb-fix-duplicate-migration-versions-2025-10-06 2>/dev/null || git checkout chore/sb-fix-duplicate-migration-versions-2025-10-06

echo "==> Renombrando migraciones duplicadas con timestamps únicos"
base_day=20250927
times=(090000 090100 090200 090300 090400 090500)
files=(
  "supabase/migrations/20250927_accept_offer_tx.sql"
  "supabase/migrations/20250927_accept_offer_tx_set_accepted_at.sql"
  "supabase/migrations/20250927_accept_offer_tx_status_pending.sql"
  "supabase/migrations/20250927_bank_accounts.sql"
  "supabase/migrations/20250927_offers_accepted_at.sql"
  "supabase/migrations/20250927_offers_status_normalize.sql"
)
new_ids=()
i=0
for f in "${files[@]}"; do
  if [[ -f "$f" ]]; then
    newver="${base_day}${times[$i]}"
    newf="supabase/migrations/${newver}_$(basename "${f#supabase/migrations/20250927_}")"
    echo "  - renombrando $f -> $newf"
    if ! git mv "$f" "$newf" 2>/dev/null; then
      mkdir -p "$(dirname "$newf")"
      mv "$f" "$newf"
    fi
    new_ids+=("$newver")
    ((i++))
  else
    echo "  - omitiendo (no existe): $f"
  fi
done

echo "==> Renombrando archivo con prefijo inválido (9999_reviews_v1.sql)"
if [[ -f supabase/migrations/9999_reviews_v1.sql ]]; then
  newver="20250927090600"
  if ! git mv supabase/migrations/9999_reviews_v1.sql "supabase/migrations/${newver}_reviews_v1.sql" 2>/dev/null; then
    mv supabase/migrations/9999_reviews_v1.sql "supabase/migrations/${newver}_reviews_v1.sql"
  fi
  new_ids+=("$newver")
else
  echo "  - omitiendo (no existe): supabase/migrations/9999_reviews_v1.sql"
fi

echo "==> Reparando historial remoto (marcar como applied)"
for id in "${new_ids[@]}"; do
  echo "  - supabase migration repair --status applied $id"
  supabase migration repair --status applied "$id"
done

echo "==> Aplicando migraciones restantes (incluida limpieza)"
supabase db push --include-all --yes

echo "==> Commit final"
git add -A
git commit -m "Supabase: dedupe duplicate migration versions (20250927*), repair history, push include-all"

echo "==> Hecho."
