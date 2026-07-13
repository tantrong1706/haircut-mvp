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
  try {
    npm ci
    npm run build
  } finally {
    Pop-Location
  }

  $resolvedFirebaseDir = (Resolve-Path -LiteralPath $firebaseDir).Path
  $publicParent = Split-Path -Parent $publicDir
  $resolvedPublicParent = (Resolve-Path -LiteralPath $publicParent).Path
  if ($resolvedPublicParent -ne $resolvedFirebaseDir -or (Split-Path -Leaf $publicDir) -ne "public") {
    throw "Đường dẫn public không an toàn: $publicDir"
  }

  Remove-Item -LiteralPath $publicDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $publicDir | Out-Null
  Copy-Item -Path (Join-Path $appDir "www\*") -Destination $publicDir -Recurse -Force
  if (-not (Test-Path -LiteralPath (Join-Path $publicDir "index.html"))) {
    throw "Bản Hosting thiếu index.html sau khi đóng gói"
  }
}

if ($IncludeFunctions) {
  Push-Location (Join-Path $firebaseDir "functions")
  try {
    npm ci
    npm run build
  } finally {
    Pop-Location
  }
}

Push-Location $firebaseDir
try {
  if ($OnlyRules) {
    firebase deploy --only firestore:rules,firestore:indexes
  } elseif ($OnlyHosting) {
    firebase deploy --only hosting
  } else {
    if ($IncludeFunctions) { firebase deploy --only functions }
    if ($IncludeFirestore) { firebase deploy --only firestore:rules,firestore:indexes }
    if ($IncludeStorage) { firebase deploy --only storage }
    firebase deploy --only hosting
  }
} finally {
  Pop-Location
}
