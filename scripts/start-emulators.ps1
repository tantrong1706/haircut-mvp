$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebaseDir = Join-Path $root "firebase"

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw "Chưa cài Firebase CLI. Hãy chạy .\scripts\setup.ps1 -InstallFirebaseCli trước."
}

Push-Location $firebaseDir
firebase emulators:start --only functions,firestore,storage
Pop-Location
