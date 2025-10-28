#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Link to remote and align service images to fix "different service versions"
supabase link || true
supabase start
echo " Linked & started. If version warning persists: run 'supabase link' again."
