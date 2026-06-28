$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "== Kiểm tra HAIRCUT MVP ==" -ForegroundColor Green

Push-Location (Join-Path $root "firebase/functions")
npm run build
Pop-Location

Push-Location (Join-Path $root "zalo-mini-app")
npm run build
Pop-Location

Write-Host "Tất cả kiểm tra đã đạt." -ForegroundColor Green
