# Handee — Aplicar migraciones a Supabase (PowerShell)
# Requisitos:
# - Tener instalado el CLI de Supabase: https://supabase.com/docs/guides/cli
# - Definir variable de entorno con el connection string de Postgres (ROLE: service or migration user):
#     $env:SUPABASE_DB_URL = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"
#   Nota: NO guardes credenciales en archivos del repo.

param(
  [switch]$UseSupabaseCli = $true,
  [string]$DbUrl = $env:SUPABASE_DB_URL
)

function Require-Cmd {
  param([string]$Name)
  $null = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $?) { throw "Comando requerido no encontrado: $Name" }
}

Write-Host "→ Iniciando migraciones (supabase/migrations)" -ForegroundColor Cyan

if (-not $DbUrl) {
  throw "Variable SUPABASE_DB_URL no definida. Establécela con tu connection string de Postgres."
}

$migrations = Get-ChildItem -Path "supabase/migrations" -Filter "*.sql" | Sort-Object Name
if (-not $migrations) { throw "No se encontraron archivos .sql en supabase/migrations" }

if ($UseSupabaseCli) {
  try {
    Require-Cmd -Name "supabase"
    Write-Host "→ Aplicando con supabase migration up (remoto)" -ForegroundColor Yellow
    supabase migration up --db-url $DbUrl
    if ($LASTEXITCODE -ne 0) { throw "Fallo supabase migration up" }
  } catch {
    Write-Warning $_
    Write-Host "→ Fallback a psql por archivo" -ForegroundColor Yellow
    $UseSupabaseCli = $false
  }
}

if (-not $UseSupabaseCli) {
  Require-Cmd -Name "psql"
  foreach ($m in $migrations) {
    Write-Host ("→ Ejecutando {0}" -f $m.Name)
    $cmd = @(
      "psql",
      "--set=ON_ERROR_STOP=1",
      "--file=$($m.FullName)",
      $DbUrl
    )
    & $cmd[0] $cmd[1] $cmd[2] $cmd[3]
    if ($LASTEXITCODE -ne 0) { throw "Fallo aplicando $($m.Name)" }
  }
}

Write-Host "✓ Migraciones aplicadas correctamente" -ForegroundColor Green
