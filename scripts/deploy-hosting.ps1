$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build-hosting.ps1")
if ($LASTEXITCODE -ne 0) { throw "Hosting packaging failed; deployment cancelled" }

Push-Location (Join-Path $root "firebase")
try {
  firebase deploy --project haircut-c7d12 --only hosting:haircut-c7d12
  if ($LASTEXITCODE -ne 0) { throw "Firebase Hosting deployment failed" }
} finally {
  Pop-Location
}

