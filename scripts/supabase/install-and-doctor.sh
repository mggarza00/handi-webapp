#!/usr/bin/env bash
set -euo pipefail

echo " Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo " Node.js not found. Install Node 18+."; exit 1;
fi
node -v

echo " Installing/Updating Supabase CLI (global)..."
# Non-fatal: prefer local devDependency but try to keep global up-to-date
npm i -g supabase@latest >/dev/null 2>&1 || true

echo " Versions:"
if ! supabase --version >/dev/null 2>&1; then
  echo " Supabase CLI not installed correctly"; exit 1;
fi
supabase --version
 
echo " Checking Docker Desktop..."
if ! docker version >/dev/null 2>&1; then
  echo " Docker not available. Start Docker Desktop."; exit 1;
fi

echo " Checking WSL2 integration (optional on Windows)..."
echo " Non-fatal checks"
docker info >/dev/null 2>&1 && echo " Docker daemon reachable"

echo " Supabase doctor:"
supabase --debug --no-telemetry --non-interactive --project-ref local doctor || true

echo " Supabase CLI installed and basic checks done."
