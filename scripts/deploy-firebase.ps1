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

$deploysHosting = $OnlyHosting -or (-not $OnlyRules)

if ($deploysHosting) {
  $appDir = Join-Path $root "zalo-mini-app"
  $publicDir = Join-Path $firebaseDir "public"

  Push-Location $appDir
  npm install
  npm run build
  Pop-Location

  $resolvedFirebaseDir = (Resolve-Path -LiteralPath $firebaseDir).Path
  $publicParent = Split-Path -Parent $publicDir
  $resolvedPublicParent = (Resolve-Path -LiteralPath $publicParent).Path
  if ($resolvedPublicParent -ne $resolvedFirebaseDir -or (Split-Path -Leaf $publicDir) -ne "public") {
    throw "Đường dẫn public không an toàn: $publicDir"
  }

  Remove-Item -LiteralPath $publicDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $publicDir | Out-Null
  Copy-Item -Path (Join-Path $appDir "dist\*") -Destination $publicDir -Recurse -Force
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
