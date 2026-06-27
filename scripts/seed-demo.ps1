$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$functionsDir = Join-Path $root "firebase/functions"

$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:GCLOUD_PROJECT = "haircut-demo"

Push-Location $functionsDir
npm run seed:demo
Pop-Location

