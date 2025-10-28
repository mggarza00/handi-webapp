#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo " This will wipe the local DB. Ctrl+C to abort."
sleep 2
supabase db reset
echo " Local DB reset + migrations re-applied."
