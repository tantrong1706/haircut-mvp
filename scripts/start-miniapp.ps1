param(
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$app = Join-Path $root "customer-web"

Push-Location $app
npm run dev -- --host 127.0.0.1 --port $Port
Pop-Location

