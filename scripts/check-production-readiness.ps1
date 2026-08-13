param(
  [switch]$RunBuild,
  [switch]$CheckLiveUrls,
  [switch]$StrictRelease,
  [switch]$ReleaseIncludesIos
)

$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$results = New-Object System.Collections.Generic.List[object]

function Add-Result($Name, $Status, $Detail) {
  $results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
  })
}

function Test-CommandExists($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Read-EnvFile($Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $map
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -gt 0 -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $parts = $line.Split("=", 2)
      $map[$parts[0].Trim()] = $parts[1].Trim()
    }
  }

  return $map
}

function Merge-ProcessEnvironment($Map, $Keys) {
  foreach ($key in $Keys) {
    $value = [Environment]::GetEnvironmentVariable($key)
    if ($value) {
      $Map[$key] = $value
    }
  }
}

function Test-PlaceholderValue($Value) {
  if (-not $Value) {
    return $true
  }

  return [string]$Value -match "^(your-|example|changeme|\.{3}|<|\[)"
}

function Test-Url($Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    return [int]$response.StatusCode
  } catch {
    return 0
  }
}

Write-Host "== Kiểm tra sẵn sàng production HAIRCUT ==" -ForegroundColor Green
Write-Host "Thư mục: $root"
Write-Host "Chế độ: $(if ($StrictRelease) { 'strict release' } else { 'local readiness' })"
Write-Host ""

$headSha = (git -C $root rev-parse HEAD).Trim()

if (Test-CommandExists "node") {
  $nodeVersion = (node --version).Trim()
  if ($nodeVersion -match "^v22\.") {
    Add-Result "Node.js" "OK" $nodeVersion
  } else {
    Add-Result "Node.js" "FAIL" "$nodeVersion; production checks yêu cầu Node.js 22"
  }
} else {
  Add-Result "Node.js" "FAIL" "Chưa cài Node.js"
}

if (Test-CommandExists "npm") {
  Add-Result "npm" "OK" (npm --version)
} else {
  Add-Result "npm" "FAIL" "Chưa cài npm"
}

if (Test-CommandExists "firebase") {
  $firebaseOutput = & firebase --version 2>$null
  $firebaseSucceeded = $?
  $firebaseVersion = $firebaseOutput | Select-Object -First 1
  if ($firebaseSucceeded -and $firebaseVersion) {
    Add-Result "Firebase CLI" "OK" $firebaseVersion
  } else {
    Add-Result "Firebase CLI" "FAIL" "Không đọc được phiên bản Firebase CLI"
  }
} else {
  Add-Result "Firebase CLI" "FAIL" "Chưa cài Firebase CLI"
}

if (Test-CommandExists "gh") {
  Add-Result "GitHub CLI" "OK" (gh --version | Select-Object -First 1)
} else {
  Add-Result "GitHub CLI" "WARN" "Chưa cài GitHub CLI hoặc chưa có trong PATH"
}

$gitStatus = git -C $root status --porcelain
if ($gitStatus) {
  if ($StrictRelease) {
    Add-Result "Git worktree" "FAIL" "Strict release yêu cầu working tree sạch"
  } else {
    Add-Result "Git worktree" "WARN" "Đang có thay đổi chưa commit"
  }
} else {
  Add-Result "Git worktree" "OK" "Sạch"
}

$firebaserc = Join-Path $root "firebase\.firebaserc"
if (Test-Path -LiteralPath $firebaserc) {
  try {
    $firebaseProject = Get-Content -Raw -LiteralPath $firebaserc | ConvertFrom-Json
    $defaultProjectId = [string]$firebaseProject.projects.default
    if ($defaultProjectId -eq "haircut-c7d12") {
      Add-Result "Firebase project" "OK" "default=haircut-c7d12"
    } else {
      Add-Result "Firebase project" "FAIL" "Project mặc định phải là haircut-c7d12"
    }
  } catch {
    Add-Result "Firebase project" "FAIL" "firebase/.firebaserc không phải JSON hợp lệ"
  }
} else {
  Add-Result "Firebase project" "FAIL" "Thiếu firebase\.firebaserc"
}

$webEnv = Read-EnvFile (Join-Path $root "zalo-mini-app\.env.production")
$envLocalPath = Join-Path $root "zalo-mini-app\.env.production.local"
$envLocal = Read-EnvFile $envLocalPath
foreach ($entry in $envLocal.GetEnumerator()) {
  $webEnv[$entry.Key] = $entry.Value
}
Merge-ProcessEnvironment $webEnv @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_ZALO_MINI_APP_ID",
  "VITE_APP_ENV",
  "VITE_ZALO_PREVIEW",
  "VITE_FUNCTION_WRITE_MODE",
  "VITE_FIREBASE_APP_CHECK_SITE_KEY",
  "VITE_MONITORING_DISABLED",
  "VITE_SENTRY_DSN",
  "VITE_SUPPORT_EMAIL",
  "VITE_SUPPORT_PHONE"
)
if ($webEnv.Count -eq 0) {
  Add-Result "Zalo web production env" "FAIL" "Thiếu biến CI hoặc zalo-mini-app\.env.production.local"
} else {
  $requiredWebEnv = @(
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
    "VITE_ZALO_MINI_APP_ID"
  )
  $missingWebEnv = @(
    $requiredWebEnv | Where-Object { Test-PlaceholderValue $webEnv[$_] }
  )
  if ($missingWebEnv.Count -gt 0) {
    Add-Result "Firebase web production config" "FAIL" ("Thiếu hoặc còn placeholder: " + ($missingWebEnv -join ", "))
  } else {
    Add-Result "Firebase web production config" "OK" "Đã cấu hình đủ biến bắt buộc"
  }

  if ($webEnv["VITE_ZALO_MINI_APP_ID"] -eq "2038116772828167300") {
    Add-Result "Zalo Mini App ID production" "OK" "Đúng ứng dụng CH Haircut Salon"
  } else {
    Add-Result "Zalo Mini App ID production" "FAIL" "Phải là 2038116772828167300"
  }

  if (
    $webEnv["VITE_FIREBASE_PROJECT_ID"] -eq "haircut-c7d12" -and
    $defaultProjectId -eq "haircut-c7d12"
  ) {
    Add-Result "Firebase project mapping" "OK" "Frontend và Firebase CLI cùng trỏ haircut-c7d12"
  } else {
    Add-Result "Firebase project mapping" "FAIL" "Frontend và firebase/.firebaserc phải cùng trỏ haircut-c7d12"
  }

  if (
    $webEnv["VITE_APP_ENV"] -eq "production" -and
    $webEnv["VITE_ZALO_PREVIEW"] -ne "true"
  ) {
    Add-Result "Zalo production mode" "OK" "Production env, preview identity đã tắt"
  } else {
    Add-Result "Zalo production mode" "FAIL" "Cần VITE_APP_ENV=production và không bật VITE_ZALO_PREVIEW"
  }

  $mode = $webEnv["VITE_FUNCTION_WRITE_MODE"]
  if (-not $mode) {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "FAIL" "Chưa đặt required"
  } elseif ($mode -eq "required") {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "OK" "required - phù hợp production nếu Functions đã deploy"
  } elseif ($mode -eq "auto") {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "FAIL" "auto có fallback direct, không dùng cho production"
  } else {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "FAIL" "$mode không được phép trong production"
  }
}

if (
  (-not (Test-PlaceholderValue $webEnv["VITE_SUPPORT_EMAIL"])) -or
  (-not (Test-PlaceholderValue $webEnv["VITE_SUPPORT_PHONE"]))
) {
  Add-Result "Privacy contact" "OK" "Đã cấu hình ít nhất một kênh hỗ trợ"
} else {
  Add-Result "Privacy contact" "FAIL" "Thiếu VITE_SUPPORT_EMAIL hoặc VITE_SUPPORT_PHONE"
}

$liveRules = Join-Path $root "firebase\firestore.rules"
$liveRulesText = ""
if (Test-Path -LiteralPath $liveRules) {
  $liveRulesText = Get-Content -Raw -LiteralPath $liveRules
}
$riskyRulePatterns = @(
  "allow\s+read\s*,\s*write\s*:\s*if\s+true",
  "allow\s+get\s*:\s*if\s+true",
  "request\.query\.limit\s*!=\s*null",
  "validDirectCustomer",
  "validDirectSession",
  "validCustomerSpinPointUpdate"
)
$matchedRisk = $riskyRulePatterns | Where-Object { $liveRulesText -match $_ } | Select-Object -First 1
if (-not $liveRulesText) {
  Add-Result "Firestore rules live" "FAIL" "Thiếu firebase/firestore.rules"
} elseif ($matchedRisk) {
  Add-Result "Firestore rules live" "FAIL" "Phát hiện rule public/direct không an toàn: $matchedRisk"
} elseif ($liveRulesText -notmatch "allow\s+create,\s*update,\s*delete\s*:\s*if\s+false") {
  Add-Result "Firestore rules live" "FAIL" "Chưa thấy chính sách khóa business writes từ client"
} else {
  Add-Result "Firestore rules live" "OK" "Đã khóa public reads và business writes từ client"
}

$appConfigPath = Join-Path $root "zalo-mini-app\app-config.json"
$manifestPath = Join-Path $root "zalo-mini-app\www\.vite\manifest.json"
if (-not (Test-Path -LiteralPath $appConfigPath)) {
  Add-Result "ZMP app-config" "FAIL" "Thiếu app-config.json"
} elseif (-not (Test-Path -LiteralPath $manifestPath)) {
  if ($StrictRelease) {
    Add-Result "ZMP app-config" "FAIL" "Strict release yêu cầu www manifest từ build:zmp"
  } else {
    Add-Result "ZMP app-config" "WARN" "Chưa có www manifest; chạy npm run build:zmp để kiểm tra asset"
  }
} else {
  try {
    $appConfig = Get-Content -Raw -LiteralPath $appConfigPath | ConvertFrom-Json
    $assets = @($appConfig.listCSS) + @($appConfig.listSyncJS) + @($appConfig.listAsyncJS)
    $missingAssets = @($assets | Where-Object {
      $relative = ([string]$_) -replace '^\./', ''
      -not (Test-Path -LiteralPath (Join-Path $root "zalo-mini-app\www\$relative"))
    })
    if ($missingAssets.Count -gt 0) {
      Add-Result "ZMP app-config" "FAIL" "Có asset không tồn tại: $($missingAssets -join ', ')"
    } elseif (
      $StrictRelease -and
      (
        [string]$appConfig.app.title -ne "CH Haircut Salon" -or
        [string]$appConfig.app.headerTitle -ne "CH Haircut Salon"
      )
    ) {
      Add-Result "ZMP app-config" "FAIL" "title và headerTitle phải là CH Haircut Salon"
    } else {
      Add-Result "ZMP app-config" "OK" "Mọi JS/CSS trong app-config đều tồn tại"
    }
  } catch {
    Add-Result "ZMP app-config" "FAIL" $_.Exception.Message
  }
}

if (Test-CommandExists "zmp") {
  Add-Result "ZMP CLI" "OK" "Đã cài đặt"
} else {
  Add-Result "ZMP CLI" "WARN" "Chưa cài ZMP CLI trên máy này"
}

$functionsEnv = Read-EnvFile (Join-Path $root "firebase\functions\.env")
Merge-ProcessEnvironment $functionsEnv @(
  "ZALO_MINI_APP_ID",
  "ENFORCE_APP_CHECK",
  "REQUIRE_ZALO_APP_CHECK",
  "ADMIN_WRITE_OPERATIONS_ENABLED"
)
if ($functionsEnv["ZALO_MINI_APP_ID"]) {
  Add-Result "Functions Zalo App ID" "OK" "Đã cấu hình"
} else {
  Add-Result "Functions Zalo App ID" "FAIL" "Thiếu ZALO_MINI_APP_ID trong firebase/functions/.env"
}

if ($functionsEnv["ENFORCE_APP_CHECK"] -eq "true") {
  Add-Result "Functions App Check chung" "OK" "Callable options đang enforcement"
} else {
  if ($StrictRelease) {
    Add-Result "Functions App Check chung" "FAIL" "Strict release yêu cầu ENFORCE_APP_CHECK=true"
  } else {
    Add-Result "Functions App Check chung" "WARN" "Source hỗ trợ nhưng chưa xác minh ENFORCE_APP_CHECK=true"
  }
}

if ($functionsEnv["REQUIRE_ZALO_APP_CHECK"] -eq "true") {
  if ($webEnv["VITE_FIREBASE_APP_CHECK_SITE_KEY"]) {
    Add-Result "Zalo App Check" "OK" "Public Zalo endpoint enforcement và frontend provider đã cấu hình"
  } else {
    Add-Result "Zalo App Check" "FAIL" "REQUIRE_ZALO_APP_CHECK=true nhưng frontend thiếu site key"
  }
} elseif ($webEnv["VITE_FIREBASE_APP_CHECK_SITE_KEY"]) {
  if ($StrictRelease) {
    Add-Result "Zalo App Check" "FAIL" "Strict release yêu cầu REQUIRE_ZALO_APP_CHECK=true"
  } else {
    Add-Result "Zalo App Check" "WARN" "Frontend provider đã cấu hình; public endpoint vẫn ở monitor mode"
  }
} else {
  if ($StrictRelease) {
    Add-Result "Zalo App Check" "FAIL" "Thiếu site key và bằng chứng enforcement production"
  } else {
    Add-Result "Zalo App Check" "WARN" "Source hỗ trợ; provider và enforcement production chưa được xác minh"
  }
}

$managerFirebaseSource = Get-Content -Raw -LiteralPath (Join-Path $root "apps\manager-mobile\src\services\firebase.ts")
$managerNativeSource = Get-Content -Raw -LiteralPath (Join-Path $root "apps\manager-mobile\src\nativeRuntime.ts")
if ($managerFirebaseSource -match "VITE_FIREBASE_APP_CHECK_SITE_KEY" -and $managerNativeSource -match "FirebaseAppCheck\.initialize") {
  Add-Result "Manager App Check source" "OK" "Có web provider và native provider"
  if ($StrictRelease) {
    if ($env:HAIRCUT_MANAGER_APP_CHECK_VERIFIED_SHA -eq $headSha) {
      Add-Result "Manager App Check thiết bị thật" "OK" "Bằng chứng Android/iPhone khớp HEAD"
    } else {
      Add-Result "Manager App Check thiết bị thật" "FAIL" "Thiếu HAIRCUT_MANAGER_APP_CHECK_VERIFIED_SHA khớp HEAD"
    }
  } else {
    Add-Result "Manager App Check thiết bị thật" "WARN" "Chưa xác minh token trên Android/iOS thật"
  }
} else {
  Add-Result "Manager App Check source" "FAIL" "Thiếu web hoặc native provider"
}

$adminFirebaseSource = Get-Content -Raw -LiteralPath (Join-Path $root "apps\admin-web\src\services\firebase.ts")
if ($adminFirebaseSource -match "VITE_FIREBASE_APP_CHECK_SITE_KEY") {
  Add-Result "Admin App Check source" "OK" "Có reCAPTCHA Enterprise provider"
} else {
  Add-Result "Admin App Check source" "FAIL" "Thiếu App Check provider"
}

if ($webEnv["VITE_MONITORING_DISABLED"] -eq "true") {
  if ($StrictRelease) {
    Add-Result "Frontend monitoring" "FAIL" "Strict release không cho phép tắt monitoring"
  } else {
    Add-Result "Frontend monitoring" "OK" "Đang tắt có chủ đích"
  }
} elseif ($webEnv["VITE_SENTRY_DSN"]) {
  Add-Result "Frontend monitoring" "OK" "Sentry DSN đã cấu hình"
} else {
  if ($StrictRelease) {
    Add-Result "Frontend monitoring" "FAIL" "Thiếu VITE_SENTRY_DSN cho strict release"
  } else {
    Add-Result "Frontend monitoring" "WARN" "Monitoring không bị tắt có chủ đích nhưng chưa có Sentry DSN"
  }
}

$functionsPackage = Get-Content -Raw -LiteralPath (Join-Path $root "firebase\functions\package.json") | ConvertFrom-Json
if ([string]$functionsPackage.engines.node -eq "22") {
  Add-Result "Functions runtime" "OK" "Node.js 22"
} else {
  Add-Result "Functions runtime" "WARN" "Nên dùng Node.js 22 cho production"
}

if (Test-Path -LiteralPath (Join-Path $root "firebase\functions\package-lock.json")) {
  Add-Result "Functions dependencies" "OK" "Có package-lock.json"
} else {
  Add-Result "Functions dependencies" "WARN" "Thiếu package-lock.json"
}

if ($RunBuild) {
  try {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check.ps1")
    if ($LASTEXITCODE -ne 0) {
      throw "Quick repository checks trả mã $LASTEXITCODE"
    }
    Add-Result "Kiểm tra repository nhanh" "OK" "Functions, Zalo, Admin, Manager và repository gates đạt"
  } catch {
    Add-Result "Kiểm tra repository nhanh" "FAIL" $_.Exception.Message
  }
} else {
  if ($StrictRelease) {
    $evidencePath = Join-Path $root ".tmp\release-readiness.json"
    if (Test-Path -LiteralPath $evidencePath) {
      try {
        $evidence = Get-Content -Raw -LiteralPath $evidencePath | ConvertFrom-Json
        if (
          [string]$evidence.headSha -eq $headSha -and
          $evidence.mode -eq "full" -and
          $evidence.readyForFirebaseDeploy -eq $true
        ) {
          Add-Result "Readiness evidence SHA" "OK" "Full-suite evidence khớp HEAD"
        } else {
          Add-Result "Readiness evidence SHA" "FAIL" "Evidence phải là full suite đạt trên đúng HEAD"
        }
      } catch {
        Add-Result "Readiness evidence SHA" "FAIL" "Không đọc được release-readiness.json"
      }
    } else {
      Add-Result "Readiness evidence SHA" "FAIL" "Thiếu .tmp/release-readiness.json"
    }
  } else {
    Add-Result "Kiểm tra repository nhanh" "WARN" "Chưa chạy trong lần kiểm tra này. Dùng -RunBuild để chạy."
  }
}

if ($CheckLiveUrls) {
  $urls = @(
    "https://haircut-c7d12.web.app",
    "https://haircut-c7d12.web.app/staff",
    "https://haircut-c7d12.web.app/owner",
    "https://haircut-c7d12.web.app/privacy",
    "https://haircut-c7d12.web.app/terms"
  )

  foreach ($url in $urls) {
    $statusCode = Test-Url $url
    if ($statusCode -eq 200) {
      Add-Result "URL $url" "OK" "HTTP 200"
    } else {
      Add-Result "URL $url" "FAIL" "HTTP $statusCode"
    }
  }
} else {
  if ($StrictRelease) {
    Add-Result "Live URLs" "FAIL" "Strict release yêu cầu -CheckLiveUrls"
  } else {
    Add-Result "Live URLs" "WARN" "Chưa kiểm tra trong lần này. Dùng -CheckLiveUrls để kiểm tra."
  }
}

if ($StrictRelease -and $ReleaseIncludesIos) {
  if ($env:HAIRCUT_IOS_BUILD_VERIFIED_SHA -eq $headSha) {
    Add-Result "iOS release evidence" "OK" "Xcode build evidence khớp HEAD"
  } else {
    Add-Result "iOS release evidence" "FAIL" "Thiếu HAIRCUT_IOS_BUILD_VERIFIED_SHA khớp HEAD"
  }
}

$colors = @{
  OK = "Green"
  WARN = "Yellow"
  FAIL = "Red"
}

foreach ($item in $results) {
  $color = $colors[$item.Status]
  Write-Host ("[{0}] {1}: {2}" -f $item.Status, $item.Name, $item.Detail) -ForegroundColor $color
}

Write-Host ""
Write-Host "Thông tin cần có trước khi mở salon thật:" -ForegroundColor Cyan
Write-Host "- Firebase Blaze đã bật nếu deploy Functions/Storage."
Write-Host "- Email owner, email staff và UID tương ứng trong Firebase Auth."
Write-Host "- Tên salon, số gương/ghế, tên từng gương/ghế."
Write-Host "- Email hoặc số điện thoại hỗ trợ để đưa vào Privacy Policy."
Write-Host "- Zalo Mini App ID production và quyền truy cập Zalo Developer."

$failCount = @($results | Where-Object { $_.Status -eq "FAIL" }).Count
if ($failCount -gt 0) {
  exit 1
}
