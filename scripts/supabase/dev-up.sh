#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Initialize config if missing
test -f supabase/config.toml || supabase init

echo " Starting Supabase stack..."
supabase start

echo
echo "URLs:"
supabase status
echo " Supabase local is running."
