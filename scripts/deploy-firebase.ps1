param(
  [switch]$OnlyRules,
  [switch]$OnlyHosting,
  [switch]$IncludeFunctions,
  [switch]$IncludeStorage
)

$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebaseDir = Join-Path $root "firebase"
$firebaserc = Join-Path $firebaseDir ".firebaserc"

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw "Firebase CLI is not installed. Run .\scripts\setup.ps1 -InstallFirebaseCli first."
}

if (-not (Test-Path -LiteralPath $firebaserc)) {
  throw "Missing firebase/.firebaserc. Run .\scripts\set-firebase-project.ps1 -ProjectId your-project-id first."
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
  $targets = @("firestore:rules", "firestore:indexes", "hosting")
  if ($IncludeFunctions) { $targets += "functions" }
  if ($IncludeStorage) { $targets += "storage" }
  firebase deploy --only ($targets -join ",")
}
Pop-Location
