# ════════════════════════════════════════════════════════════════════════
# Copy SempaiHQ's database STRUCTURE (no user data) into the TEST project,
# then apply the Phase 3 rules to the test copy only.
#
# Run in your own PowerShell from the app folder:
#   powershell -ExecutionPolicy Bypass -File scripts\staging\copy-schema.ps1
#
# It asks for two "Session pooler" connection strings (Supabase → your
# project → Connect → Session pooler), with [YOUR-PASSWORD] replaced by that
# project's database password. Nothing is saved except the structure file.
# The PRODUCTION database is only READ (pg_dump), never changed.
# ════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$bin = 'C:\Program Files\PostgreSQL\18\bin'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force $out | Out-Null

Write-Host ''
Write-Host 'PRODUCTION (xqeimsncmnqsiowftdmz) - read only' -ForegroundColor Cyan
$prod = Read-Host 'Paste the PRODUCTION Session pooler connection string'
Write-Host 'TEST project (the new free one) - will be filled' -ForegroundColor Yellow
$test = Read-Host 'Paste the TEST project Session pooler connection string'

if ($test -match 'xqeimsncmnqsiowftdmz') {
  throw 'The TEST connection string points at PRODUCTION. Stopping - nothing was changed.'
}
if ($prod -notmatch 'xqeimsncmnqsiowftdmz') {
  throw 'The PRODUCTION connection string is not the SempaiHQ project. Stopping.'
}

Write-Host "`n1/4  Reading production structure (no data)..." -ForegroundColor Cyan
& "$bin\pg_dump.exe" --schema-only --schema=public --no-owner --no-comments "--dbname=$prod" -f "$out\schema.sql"
if ($LASTEXITCODE -ne 0) { throw 'Reading production failed (check the connection string / password).' }

Write-Host '2/4  Preparing the test project...' -ForegroundColor Cyan
& "$bin\psql.exe" "--dbname=$test" -q -c 'create extension if not exists pg_net;' 2>$null

Write-Host '3/4  Creating tables, functions and current rules in the test project...' -ForegroundColor Cyan
& "$bin\psql.exe" "--dbname=$test" -q -v ON_ERROR_STOP=0 -f "$out\schema.sql" 2> "$out\restore-errors.txt"
$restoreErrors = (Get-Content "$out\restore-errors.txt" -ErrorAction SilentlyContinue | Select-String 'ERROR').Count

Write-Host '4/4  Applying the Phase 3 rules to the TEST project...' -ForegroundColor Cyan
& "$bin\psql.exe" "--dbname=$test" -q -v ON_ERROR_STOP=1 -f "$root\migrations\20261122_author_notes.sql" 2> "$out\notes-errors.txt"
& "$bin\psql.exe" "--dbname=$test" -q -v ON_ERROR_STOP=1 -f "$root\migrations\20261123_phase3_rls_DRAFT.sql" 2> "$out\rules-errors.txt"
$rulesOk = $LASTEXITCODE -eq 0

Write-Host ''
Write-Host "Structure copied. Restore warnings: $restoreErrors (send scripts\staging\out\restore-errors.txt to Claude if not 0)."
if ($rulesOk) { Write-Host 'Phase 3 rules applied to the TEST project.' -ForegroundColor Green }
else { Write-Host 'Phase 3 rules FAILED on the test project - send scripts\staging\out\rules-errors.txt to Claude.' -ForegroundColor Red }
