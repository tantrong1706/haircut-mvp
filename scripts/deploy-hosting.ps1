$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build-hosting.ps1")

Push-Location (Join-Path $root "firebase")
firebase deploy --only hosting
Pop-Location

