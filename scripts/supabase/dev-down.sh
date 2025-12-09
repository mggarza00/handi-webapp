#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo " Stopping Supabase stack..."
supabase stop || true
echo " Stopped."
