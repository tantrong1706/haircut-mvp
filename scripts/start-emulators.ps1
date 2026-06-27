$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebaseDir = Join-Path $root "firebase"

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw "Firebase CLI is not installed. Run .\scripts\setup.ps1 -InstallFirebaseCli first."
}

Push-Location $firebaseDir
firebase emulators:start --only functions,firestore,storage
Pop-Location

