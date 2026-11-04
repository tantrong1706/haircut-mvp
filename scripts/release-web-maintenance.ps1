param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedSha,
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

Push-Location $root
try {
  node scripts/check-web-maintenance.mjs --sha $ExpectedSha
  if ($LASTEXITCODE -ne 0) { throw "Web release gates failed" }
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-production-readiness.ps1") -StrictRelease -WebMaintenance -CheckLiveUrls
  if ($LASTEXITCODE -ne 0) { throw "Web production preflight failed" }
  $scope = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "web-maintenance-scope.json") | ConvertFrom-Json
  $selectors = ($scope.functions | ForEach-Object { "functions:$_" }) -join ","
  if ($DryRun) {
    Write-Host "WEB_MAINTENANCE_DRY_RUN=PASS SHA=$ExpectedSha CALLABLES=$($scope.functions.Count)"
    return
  }
  Push-Location (Join-Path $root "firebase/functions")
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Functions build failed" }
  } finally { Pop-Location }
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build-hosting.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Hosting packaging failed" }
  node scripts/check-web-maintenance.mjs --sha $ExpectedSha
  if ($LASTEXITCODE -ne 0) { throw "Release state changed during build" }
  Push-Location (Join-Path $root "firebase")
  try {
    firebase deploy --project haircut-c7d12 --only $selectors --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "Scoped Functions deploy failed; Hosting was not changed" }
    node (Join-Path $PSScriptRoot "check-web-maintenance.mjs") --sha $ExpectedSha
    if ($LASTEXITCODE -ne 0) { throw "Release state changed; Hosting deploy cancelled" }
    firebase deploy --project haircut-c7d12 --only hosting:haircut-c7d12 --message "Web maintenance $ExpectedSha" --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "Scoped Hosting deploy failed" }
  } finally { Pop-Location }
} finally { Pop-Location }
