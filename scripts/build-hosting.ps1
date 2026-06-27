$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$miniAppDir = Join-Path $root "zalo-mini-app"
$distDir = Join-Path $miniAppDir "dist"
$publicDir = Join-Path $root "firebase/public"

Push-Location $miniAppDir
npm run build
Pop-Location

$resolvedPublic = Resolve-Path -LiteralPath $publicDir
if (-not ($resolvedPublic.Path.StartsWith($root.Path))) {
  throw "Refusing to clean outside project"
}

Get-ChildItem -LiteralPath $resolvedPublic.Path -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $distDir "*") -Destination $resolvedPublic.Path -Recurse -Force

Write-Host "Hosting build copied to firebase/public." -ForegroundColor Green

