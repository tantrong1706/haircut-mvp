param(
  [switch]$OnlyRules,
  [switch]$OnlyHosting,
  [switch]$IncludeFirestore,
  [switch]$IncludeFunctions,
  [switch]$IncludeStorage
)

$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebaseDir = Join-Path $root "firebase"
$firebaserc = Join-Path $firebaseDir ".firebaserc"

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw "Chưa cài Firebase CLI. Hãy chạy .\scripts\setup.ps1 -InstallFirebaseCli trước."
}

if (-not (Test-Path -LiteralPath $firebaserc)) {
  throw "Thiếu firebase/.firebaserc. Hãy chạy .\scripts\set-firebase-project.ps1 -ProjectId your-project-id trước."
}

if ($IncludeFunctions) {
  Push-Location (Join-Path $firebaseDir "functions")
  npm install
  npm run build
  Pop-Location
}

Push-Location $firebaseDir
if ($OnlyRules) {
  firebase deploy --only firestore:rules,firestore:indexes
} elseif ($OnlyHosting) {
  firebase deploy --only hosting
} else {
  $targets = @("hosting")
  if ($IncludeFirestore) { $targets += "firestore:rules", "firestore:indexes" }
  if ($IncludeFunctions) { $targets += "functions" }
  if ($IncludeStorage) { $targets += "storage" }
  firebase deploy --only ($targets -join ",")
}
Pop-Location
