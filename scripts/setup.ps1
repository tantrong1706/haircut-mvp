param(
  [switch]$InstallFirebaseCli
)

$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "== HAIRCUT MVP setup ==" -ForegroundColor Green
Write-Host "Project: $root"

function Run-Step($Name, $ScriptBlock) {
  Write-Host ""
  Write-Host ">> $Name" -ForegroundColor Cyan
  & $ScriptBlock
}

Run-Step "Checking Node/NPM" {
  node --version
  npm --version
}

Run-Step "Checking Firebase CLI" {
  $firebase = Get-Command firebase -ErrorAction SilentlyContinue
  if (-not $firebase -and $InstallFirebaseCli) {
    npm install -g firebase-tools
  } elseif (-not $firebase) {
    Write-Host "Firebase CLI is not installed. Run: .\scripts\setup.ps1 -InstallFirebaseCli" -ForegroundColor Yellow
  }

  if (Get-Command firebase -ErrorAction SilentlyContinue) {
    firebase --version
  }
}

Run-Step "Installing Firebase Functions dependencies" {
  Push-Location (Join-Path $root "firebase/functions")
  npm install
  npm run build
  Pop-Location
}

Run-Step "Installing Zalo Mini App dependencies" {
  Push-Location (Join-Path $root "zalo-mini-app")
  npm install
  npm run build
  Pop-Location
}

Write-Host ""
Write-Host "Setup finished." -ForegroundColor Green
Write-Host "Run Mini App: .\scripts\start-miniapp.ps1"
Write-Host "Run Firebase Emulator: .\scripts\start-emulators.ps1"
Write-Host "Seed demo data: .\scripts\seed-demo.ps1"
Write-Host "Login Firebase: .\scripts\firebase-login.ps1"
Write-Host "Set Firebase project: .\scripts\set-firebase-project.ps1 -ProjectId your-project-id"
Write-Host "Deploy Firebase: .\scripts\deploy-firebase.ps1"
