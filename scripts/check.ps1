$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "== HAIRCUT MVP check ==" -ForegroundColor Green

Push-Location (Join-Path $root "firebase/functions")
npm run build
Pop-Location

Push-Location (Join-Path $root "zalo-mini-app")
npm run build
Pop-Location

Write-Host "All checks passed." -ForegroundColor Green

