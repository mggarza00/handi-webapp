#!/usr/bin/env bash
set -euo pipefail

echo "== 1/6 Crear rama de respaldo por si acaso"
BRANCH="fix/revert-offer-ui-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH"

echo "== 2/6 Definir fecha de corte (antes de los cambios de hoy)"
BEFORE="2025-09-20 00:00"

echo "== 3/6 Localizar rutas (algunas pueden no existir y se ignoran)"
FILES=()
for p in \
  "components/chat/ChatPanel.tsx" \
  "components/chat/MessageList.tsx" \
  "components/chat/ChatListItem.tsx" \
  "app/(app)/mensajes/_components/ChatListItem.tsx" \
  "app/(app)/mensajes/_components/ChatWindow.tsx"
do
  if [ -f "$p" ]; then
    FILES+=("$p")
  fi
done

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No se encontraron archivos objetivo. Aborta."
  exit 1
fi

echo "Archivos a revertir:"
printf ' - %s\n' "${FILES[@]}"

echo "== 4/6 Encontrar el último commit BUENO (antes de $BEFORE) para cada archivo"
declare -A GOOD
for f in "${FILES[@]}"; do
  HASH="$(git log --follow --before="$BEFORE" -n 1 --pretty=format:%H -- "$f" 2>/dev/null || true)"
  if [ -n "$HASH" ]; then
    GOOD["$f"]="$HASH"
    printf "OK   %-70s  %s\n" "$f" "${GOOD[$f]}"
  else
    printf "WARN %-70s  (sin commit antes de la fecha)\n" "$f"
  fi
done

echo "== 5/6 Restaurar desde el commit BUENO"
TO_RESTORE=()
for f in "${FILES[@]}"; do
  if [ -n "${GOOD[$f]:-}" ]; then
    TO_RESTORE+=("$f")
  fi
done

if [ "${#TO_RESTORE[@]}" -eq 0 ]; then
  echo "No hay commits previos para restaurar. Revisa la fecha BEFORE o el historial."
  exit 2
fi

for f in "${TO_RESTORE[@]}"; do
  SRC="${GOOD[$f]}"
  echo "Restaurando $f desde $SRC"
  if git show "$SRC:$f" >/dev/null 2>&1; then
    git restore --source "$SRC" -- "$f" || git checkout "$SRC" -- "$f"
  else
    echo "ERROR: la ruta $f no existe en el commit $SRC"
    exit 3
  fi
done

echo "== 6/6 Commit de la reversión (solo estos archivos)"
git add -- "${TO_RESTORE[@]}"
LIST="$(printf ' - %s\n' "${TO_RESTORE[@]}")"
git commit -m "revert(chat-offers): restore pre-2025-09-20 versions of chat offer UI/components" \
  -m "BEFORE=$BEFORE" \
  -m "Files:\n$LIST"

echo "== Verificación rápida =="
git status --short || true

echo "typecheck (puede mostrar avisos; buscamos evitar errores críticos)"
npm run typecheck -s || true

echo "Listo. Rama creada: $BRANCH"
echo "Para push:" \
     "git push -u origin \"$BRANCH\""