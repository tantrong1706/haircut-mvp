param(
  [switch]$RunBuild,
  [switch]$CheckLiveUrls
)

$ErrorActionPreference = "Stop"
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
Write-Host ""

if (Test-CommandExists "node") {
  Add-Result "Node.js" "OK" (node --version)
} else {
  Add-Result "Node.js" "FAIL" "Chưa cài Node.js"
}

if (Test-CommandExists "npm") {
  Add-Result "npm" "OK" (npm --version)
} else {
  Add-Result "npm" "FAIL" "Chưa cài npm"
}

if (Test-CommandExists "firebase") {
  Add-Result "Firebase CLI" "OK" (firebase --version)
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
  Add-Result "Git worktree" "WARN" "Đang có thay đổi chưa commit"
} else {
  Add-Result "Git worktree" "OK" "Sạch"
}

$firebaserc = Join-Path $root "firebase\.firebaserc"
if (Test-Path -LiteralPath $firebaserc) {
  $projectText = Get-Content -Raw -LiteralPath $firebaserc
  Add-Result "Firebase project" "OK" ($projectText -replace "\s+", " ").Trim()
} else {
  Add-Result "Firebase project" "FAIL" "Thiếu firebase\.firebaserc"
}

$envPath = Join-Path $root "zalo-mini-app\.env"
$env = Read-EnvFile $envPath
if ($env.Count -eq 0) {
  Add-Result "Zalo web .env" "WARN" "Thiếu zalo-mini-app\.env, app có thể chạy bằng mock/direct tùy môi trường"
} else {
  $mode = $env["VITE_FUNCTION_WRITE_MODE"]
  if (-not $mode) {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "WARN" "Chưa đặt, app mặc định dùng direct"
  } elseif ($mode -eq "required") {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "OK" "required - phù hợp production nếu Functions đã deploy"
  } elseif ($mode -eq "auto") {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "WARN" "auto - phù hợp giai đoạn chuyển tiếp, chưa phải khóa production"
  } else {
    Add-Result "VITE_FUNCTION_WRITE_MODE" "WARN" "$mode - đang là chế độ test nội bộ"
  }
}

$liveRules = Join-Path $root "firebase\firestore.rules"
$liveRulesText = ""
if (Test-Path -LiteralPath $liveRules) {
  $liveRulesText = Get-Content -Raw -LiteralPath $liveRules
}
if ($liveRulesText -match "allow\s+read\s*,\s*write\s*:\s*if\s+true") {
  Add-Result "Firestore rules live" "WARN" "Rules live trong repo vẫn mở để test nội bộ"
} else {
  Add-Result "Firestore rules live" "OK" "Không thấy allow read/write true trong file live"
}

$prodRules = Join-Path $root "firebase\firestore.rules.production.example"
$prodRulesText = ""
if (Test-Path -LiteralPath $prodRules) {
  $prodRulesText = Get-Content -Raw -LiteralPath $prodRules
}
if (-not $prodRulesText) {
  Add-Result "Rules production mẫu" "FAIL" "Thiếu firestore.rules.production.example"
} elseif ($prodRulesText -match "allow\s+read\s*,\s*write\s*:\s*if\s+true") {
  Add-Result "Rules production mẫu" "FAIL" "Còn allow read/write true"
} elseif ($prodRulesText -match "allow\s+create,\s+update,\s+delete:\s+if\s+false") {
  Add-Result "Rules production mẫu" "OK" "Đã khóa ghi client cho các collection nghiệp vụ"
} else {
  Add-Result "Rules production mẫu" "WARN" "Cần rà lại rules production"
}

if (Test-Path -LiteralPath (Join-Path $root "firebase\functions\package-lock.json")) {
  Add-Result "Functions dependencies" "OK" "Có package-lock.json"
} else {
  Add-Result "Functions dependencies" "WARN" "Thiếu package-lock.json"
}

if ($RunBuild) {
  try {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check.ps1")
    Add-Result "Build local" "OK" "Functions và web build pass"
  } catch {
    Add-Result "Build local" "FAIL" $_.Exception.Message
  }
} else {
  Add-Result "Build local" "WARN" "Chưa chạy trong lần kiểm tra này. Dùng -RunBuild để chạy."
}

if ($CheckLiveUrls) {
  $urls = @(
    "https://haircut-c7d12.web.app",
    "https://haircut-c7d12.web.app/staff",
    "https://haircut-c7d12.web.app/owner",
    "https://haircut-c7d12.web.app/privacy"
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
  Add-Result "Live URLs" "WARN" "Chưa kiểm tra trong lần này. Dùng -CheckLiveUrls để kiểm tra."
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

$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
if ($failCount -gt 0) {
  exit 1
}
