param(
  [switch]$OnlyRules,
  [switch]$OnlyHosting,
  [switch]$IncludeFirestore,
  [switch]$IncludeFunctions,
  [switch]$IncludeStorage,
  [switch]$AllowDirtyWorktree,
  [switch]$AllowNonReleaseBranch,
  [switch]$SkipReadinessEvidence,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebaseDir = Join-Path $root "firebase"
$firebaserc = Join-Path $firebaseDir ".firebaserc"
$evidencePath = Join-Path $root ".tmp\release-readiness.json"

function Assert-NativeSuccess([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step thất bại với mã thoát $LASTEXITCODE"
  }
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw "Chưa cài Firebase CLI. Hãy chạy .\scripts\setup.ps1 -InstallFirebaseCli trước."
}

if (-not (Test-Path -LiteralPath $firebaserc)) {
  throw "Thiếu firebase/.firebaserc. Hãy chạy .\scripts\set-firebase-project.ps1 -ProjectId your-project-id trước."
}

function Assert-BreakGlassApproval {
  if ($env:HAIRCUT_BREAK_GLASS -ne "true") {
    throw "Cờ bỏ qua release gate yêu cầu HAIRCUT_BREAK_GLASS=true."
  }
  $reason = [string]$env:HAIRCUT_BREAK_GLASS_REASON
  if ([string]::IsNullOrWhiteSpace($reason) -or $reason.Trim().Length -lt 12) {
    throw "Cờ bỏ qua release gate yêu cầu HAIRCUT_BREAK_GLASS_REASON mô tả cụ thể."
  }
  if ($env:CI -eq "true" -or $env:GITHUB_ACTIONS -eq "true") {
    throw "Break-glass chỉ được xác nhận tương tác ngoài CI."
  }
  $confirmation = Read-Host "Nhập DEPLOY-BREAK-GLASS để xác nhận ngoại lệ"
  if ($confirmation -ne "DEPLOY-BREAK-GLASS") {
    throw "Đã hủy break-glass."
  }
}

$usesBreakGlass =
  $AllowDirtyWorktree -or
  $AllowNonReleaseBranch -or
  $SkipReadinessEvidence
if ($usesBreakGlass) {
  Assert-BreakGlassApproval
}

$branch = (git -C $root branch --show-current).Trim()
$headSha = (git -C $root rev-parse HEAD).Trim()
$gitStatus = @(git -C $root status --porcelain)
Write-Host "Branch sắp deploy: $branch" -ForegroundColor Cyan
Write-Host "Commit sắp deploy: $headSha" -ForegroundColor Cyan

if ($gitStatus.Count -gt 0 -and -not $AllowDirtyWorktree) {
  throw "Working tree chưa sạch. Commit hoặc loại bỏ thay đổi, hoặc dùng -AllowDirtyWorktree có chủ đích."
}

$allowedBranch = $branch -eq "main" -or $branch -like "release/*"
if (-not $allowedBranch -and -not $AllowNonReleaseBranch) {
  throw "Chỉ main hoặc release/* được deploy mặc định. Dùng -AllowNonReleaseBranch có chủ đích."
}

if (-not $SkipReadinessEvidence) {
  if (-not (Test-Path -LiteralPath $evidencePath)) {
    throw "Thiếu .tmp/release-readiness.json. Chạy .\scripts\check.ps1 -Full trước."
  }
  $evidence = Get-Content -Raw -LiteralPath $evidencePath | ConvertFrom-Json
  if ([string]$evidence.headSha -ne $headSha) {
    throw "Readiness evidence thuộc commit khác: $($evidence.headSha)"
  }
  if ($evidence.mode -ne "full" -or $evidence.readyForFirebaseDeploy -ne $true) {
    throw "Readiness evidence chưa xác nhận full suite đạt."
  }

  & powershell -NoProfile -ExecutionPolicy Bypass -File (
    Join-Path $PSScriptRoot "check-production-readiness.ps1"
  ) -StrictRelease -CheckLiveUrls
  Assert-NativeSuccess "Strict production readiness"
}

if ($DryRun) {
  Write-Host "Dry run đạt: deploy gates hợp lệ, không có lệnh deploy nào được chạy." -ForegroundColor Green
  exit 0
}

$deploysHosting = $OnlyHosting -or (-not $OnlyRules)

if ($deploysHosting) {
  $appDir = Join-Path $root "zalo-mini-app"
  $publicDir = Join-Path $firebaseDir "public"

  Push-Location $appDir
  try {
    npm ci
    Assert-NativeSuccess "Cài dependency frontend"
    npm run build
    Assert-NativeSuccess "Build frontend"
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
    Assert-NativeSuccess "Cài dependency Functions"
    npm run build
    Assert-NativeSuccess "Build Functions"
  } finally {
    Pop-Location
  }
}

Push-Location $firebaseDir
try {
  if ($OnlyRules) {
    firebase deploy --only firestore:rules,firestore:indexes
    Assert-NativeSuccess "Deploy Firestore rules/indexes"
  } elseif ($OnlyHosting) {
    firebase deploy --only hosting
    Assert-NativeSuccess "Deploy Hosting"
  } else {
    if ($IncludeFunctions) {
      firebase deploy --only functions
      Assert-NativeSuccess "Deploy Functions"
    }
    if ($IncludeFirestore) {
      firebase deploy --only firestore:rules,firestore:indexes
      Assert-NativeSuccess "Deploy Firestore rules/indexes"
    }
    if ($IncludeStorage) {
      firebase deploy --only storage
      Assert-NativeSuccess "Deploy Storage rules"
    }
    firebase deploy --only hosting
    Assert-NativeSuccess "Deploy Hosting"
  }
} finally {
  Pop-Location
}
