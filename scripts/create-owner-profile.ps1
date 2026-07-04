param(
  [string]$Email,
  [string]$OwnerName,
  [string]$SalonName,
  [string]$Phone
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$appDir = Join-Path $root "zalo-mini-app"
$nodeModules = Join-Path $appDir "node_modules"

if (-not $Email) {
  $Email = Read-Host "Email tai khoan Firebase Auth"
}

if (-not $OwnerName) {
  $OwnerName = Read-Host "Ten chu salon"
}

if (-not $SalonName) {
  $SalonName = Read-Host "Ten salon"
}

if (-not $Phone) {
  $Phone = Read-Host "So dien thoai salon (co the bo trong)"
}

$securePassword = Read-Host "Mat khau tai khoan Firebase Auth" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = $null

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)

  if (-not (Test-Path $nodeModules)) {
    Push-Location $appDir
    npm ci
    Pop-Location
  }

  $env:HAIRCUT_OWNER_EMAIL = $Email
  $env:HAIRCUT_OWNER_PASSWORD = $plainPassword
  $env:HAIRCUT_OWNER_NAME = $OwnerName
  $env:HAIRCUT_SALON_NAME = $SalonName
  $env:HAIRCUT_SALON_PHONE = $Phone

  Push-Location $appDir
  node ".\tools\create-owner-profile.mjs"
  Pop-Location
}
finally {
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }

  Remove-Item Env:\HAIRCUT_OWNER_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:\HAIRCUT_OWNER_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:\HAIRCUT_OWNER_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:\HAIRCUT_SALON_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:\HAIRCUT_SALON_PHONE -ErrorAction SilentlyContinue
}
