$ErrorActionPreference = "Stop"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  Write-Host "Firebase CLI is not installed. Installing now..." -ForegroundColor Yellow
  npm install -g firebase-tools
}

firebase login
firebase login:list
