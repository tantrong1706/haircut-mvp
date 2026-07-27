param(
  [switch]$Full
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result([string]$Name, [string]$Status, [string]$Detail, [bool]$Required = $true) {
  $results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
    Required = $Required
  })
}

function Invoke-Step(
  [string]$Name,
  [string]$Directory,
  [scriptblock]$Command,
  [bool]$Required = $true
) {
  Write-Host "== $Name ==" -ForegroundColor Cyan
  Push-Location $Directory
  try {
    $global:LASTEXITCODE = 0
    & $Command
    if ($LASTEXITCODE -ne 0) {
      Add-Result $Name "FAILED" "Exit code $LASTEXITCODE" $Required
      return
    }
    Add-Result $Name "PASSED" "Hoàn tất" $Required
  } catch {
    Add-Result $Name "FAILED" $_.Exception.Message $Required
  } finally {
    Pop-Location
  }
}

function Test-TrackedRepositorySafety {
  $tracked = @(git -C $root ls-files)
  $forbidden = @(
    "firebase/public/",
    "node_modules/",
    "/dist/",
    "/www/",
    "playwright-report/",
    "test-results/"
  )
  foreach ($pattern in $forbidden) {
    if ($tracked | Where-Object { "/$_" -like "*$pattern*" } | Select-Object -First 1) {
      throw "Generated output đang được Git theo dõi: $pattern"
    }
  }

  $credentialPatterns = @(
    "apps/manager-mobile/android/app/google-services.json",
    "apps/manager-mobile/ios/App/App/GoogleService-Info.plist",
    "*.jks",
    "*.keystore",
    "*.p8",
    "*.p12",
    "*.mobileprovision"
  )
  foreach ($pattern in $credentialPatterns) {
    if ($tracked | Where-Object { $_ -like $pattern } | Select-Object -First 1) {
      throw "Credential native đang được Git theo dõi: $pattern"
    }
  }
}

$mode = if ($Full) { "full" } else { "quick" }
Write-Host "== HAIRCUT repository checks ($mode) ==" -ForegroundColor Green
Write-Host "Root: $root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[FAILED] Node.js 22 runtime: Chưa cài Node.js" -ForegroundColor Red
  exit 1
}

$nodeVersion = (node --version).Trim()
if ($nodeVersion -notmatch "^v22\.") {
  Write-Host "[FAILED] Node.js 22 runtime: Đang dùng $nodeVersion" -ForegroundColor Red
  Write-Host "Dùng Node.js 22 như Functions và GitHub Actions trước khi chạy readiness." -ForegroundColor Yellow
  exit 1
}

Invoke-Step "Functions npm ci" (Join-Path $root "firebase/functions") { npm ci }
Invoke-Step "Functions source checks" (Join-Path $root "firebase/functions") { npm run check }
Invoke-Step "Functions build" (Join-Path $root "firebase/functions") { npm run build }

Invoke-Step "Zalo npm ci" (Join-Path $root "zalo-mini-app") { npm ci }
Invoke-Step "Zalo lint" (Join-Path $root "zalo-mini-app") { npm run lint }
Invoke-Step "Zalo format" (Join-Path $root "zalo-mini-app") { npm run format:check }
Invoke-Step "Zalo unit tests" (Join-Path $root "zalo-mini-app") { npm run test:run }
Invoke-Step "Zalo package build" (Join-Path $root "zalo-mini-app") { npm run build:zmp }

Invoke-Step "Admin npm ci" (Join-Path $root "apps/admin-web") { npm ci }
Invoke-Step "Admin checks" (Join-Path $root "apps/admin-web") { npm run check }

Invoke-Step "Manager npm ci" (Join-Path $root "apps/manager-mobile") { npm ci }
Invoke-Step "Manager checks" (Join-Path $root "apps/manager-mobile") { npm run check }

Invoke-Step "Git diff check" $root { git diff --check }
Invoke-Step "Tracked output and credential check" $root { Test-TrackedRepositorySafety }
Invoke-Step "Tracked secret scan" $root { node scripts/check-secrets.mjs }
Invoke-Step "CSP source synchronization" $root { node scripts/sync-csp.mjs --check }

if ($Full) {
  Invoke-Step "Rules emulator tests" (Join-Path $root "firebase/functions") { npm run test:rules }
  Invoke-Step "Integration emulator tests" (Join-Path $root "firebase/functions") {
    npm run test:integration
  }
  Invoke-Step "Zalo review readiness" (Join-Path $root "zalo-mini-app") {
    npm run check:zalo-review
  }
  Invoke-Step "Browser E2E" (Join-Path $root "zalo-mini-app") { npm run test:e2e }
  Invoke-Step "Manager Android sync" (Join-Path $root "apps/manager-mobile") {
    npx cap sync android
  } $false

  if ($IsMacOS) {
    Invoke-Step "Manager iOS sync" (Join-Path $root "apps/manager-mobile") {
      npx cap sync ios
    } $false
  } else {
    Add-Result "Manager iOS sync" "BLOCKED" "Yêu cầu macOS/Xcode" $false
  }

  Invoke-Step "Production configuration readiness" $root {
    powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-production-readiness.ps1")
  }
} else {
  Add-Result "Full emulator, E2E and readiness suites" "NOT RUN" "Dùng -Full để chạy" $false
}

$counts = @{
  Passed = @($results | Where-Object Status -eq "PASSED").Count
  Failed = @($results | Where-Object Status -eq "FAILED").Count
  Blocked = @($results | Where-Object Status -eq "BLOCKED").Count
  NotRun = @($results | Where-Object Status -eq "NOT RUN").Count
}

Write-Host ""
foreach ($item in $results) {
  $color = switch ($item.Status) {
    "PASSED" { "Green" }
    "FAILED" { "Red" }
    "BLOCKED" { "Yellow" }
    default { "DarkYellow" }
  }
  Write-Host ("[{0}] {1}: {2}" -f $item.Status, $item.Name, $item.Detail) -ForegroundColor $color
}
Write-Host ""
Write-Host ("Passed: {0} | Failed: {1} | Blocked: {2} | Not run: {3} | Total: {4}" -f $counts.Passed, $counts.Failed, $counts.Blocked, $counts.NotRun, $results.Count)

$requiredFailures = @($results | Where-Object { $_.Required -and $_.Status -ne "PASSED" })
if ($Full) {
  $headSha = (git -C $root rev-parse HEAD).Trim()
  $evidenceDir = Join-Path $root ".tmp"
  New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
  $evidence = [ordered]@{
    schemaVersion = 1
    headSha = $headSha
    checkedAtUtc = [DateTime]::UtcNow.ToString("o")
    mode = "full"
    readyForFirebaseDeploy = ($requiredFailures.Count -eq 0)
    nodeVersion = $(if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { "NOT FOUND" })
    npmVersion = $(if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version } else { "NOT FOUND" })
    javaVersion = $(if (Get-Command java -ErrorAction SilentlyContinue) { (java -version 2>&1 | Select-Object -First 1) } else { "NOT FOUND" })
    firebaseCliVersion = $(if (Get-Command firebase -ErrorAction SilentlyContinue) { firebase --version } else { "NOT FOUND" })
    summary = $counts
    results = @($results)
  }
  $evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidenceDir "release-readiness.json") -Encoding UTF8
}

if ($requiredFailures.Count -gt 0) {
  exit 1
}
