param(
  [switch]$InstallFirebaseCli
)

$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "== Thiết lập HAIRCUT MVP ==" -ForegroundColor Green
Write-Host "Dự án: $root"

function Run-Step($Name, $ScriptBlock) {
  Write-Host ""
  Write-Host ">> $Name" -ForegroundColor Cyan
  & $ScriptBlock
}

Run-Step "Kiểm tra Node/NPM" {
  node --version
  npm --version
}

Run-Step "Kiểm tra Firebase CLI" {
  $firebase = Get-Command firebase -ErrorAction SilentlyContinue
  if (-not $firebase -and $InstallFirebaseCli) {
    npm install -g firebase-tools
  } elseif (-not $firebase) {
    Write-Host "Chưa cài Firebase CLI. Chạy: .\scripts\setup.ps1 -InstallFirebaseCli" -ForegroundColor Yellow
  }

  if (Get-Command firebase -ErrorAction SilentlyContinue) {
    firebase --version
  }
}

Run-Step "Cài thư viện Firebase Functions" {
  Push-Location (Join-Path $root "firebase/functions")
  npm install
  npm run build
  Pop-Location
}

Run-Step "Cài thư viện Zalo Mini App" {
  Push-Location (Join-Path $root "zalo-mini-app")
  npm install
  npm run build
  Pop-Location
}

Write-Host ""
Write-Host "Thiết lập xong." -ForegroundColor Green
Write-Host "Chạy Mini App: .\scripts\start-miniapp.ps1"
Write-Host "Chạy Firebase Emulator: .\scripts\start-emulators.ps1"
Write-Host "Nạp dữ liệu demo: .\scripts\seed-demo.ps1"
Write-Host "Đăng nhập Firebase: .\scripts\firebase-login.ps1"
Write-Host "Chọn Firebase project: .\scripts\set-firebase-project.ps1 -ProjectId your-project-id"
Write-Host "Triển khai Firebase: .\scripts\deploy-firebase.ps1"
