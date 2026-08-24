$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$miniAppDir = Join-Path $root "zalo-mini-app"
$buildDir = Join-Path $miniAppDir "www"
$publicDir = Join-Path $root "firebase/public"

Push-Location $miniAppDir
npm run build
Pop-Location

$resolvedFirebaseDir = (Resolve-Path -LiteralPath (Join-Path $root "firebase")).Path
$publicParent = Split-Path -Parent $publicDir
if ($publicParent -ne $resolvedFirebaseDir -or (Split-Path -Leaf $publicDir) -ne "public") {
  throw "Refusing to clean outside project"
}

if (-not (Test-Path -LiteralPath $publicDir)) {
  New-Item -ItemType Directory -Path $publicDir | Out-Null
}

$resolvedPublic = Resolve-Path -LiteralPath $publicDir
if ((Split-Path -Parent $resolvedPublic.Path) -ne $resolvedFirebaseDir) {
  throw "Refusing to clean outside Firebase directory"
}

Get-ChildItem -LiteralPath $resolvedPublic.Path -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $buildDir "*") -Destination $resolvedPublic.Path -Recurse -Force

Write-Host "Đã chép bản build Hosting vào firebase/public." -ForegroundColor Green
