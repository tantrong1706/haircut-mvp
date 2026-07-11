$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$miniAppDir = Join-Path $root "zalo-mini-app"
$buildDir = Join-Path $miniAppDir "www"
$publicDir = Join-Path $root "firebase/public"

Push-Location $miniAppDir
npm run build
Pop-Location

$resolvedPublic = Resolve-Path -LiteralPath $publicDir
if (-not ($resolvedPublic.Path.StartsWith($root.Path))) {
  throw "Refusing to clean outside project"
}

Get-ChildItem -LiteralPath $resolvedPublic.Path -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $buildDir "*") -Destination $resolvedPublic.Path -Recurse -Force

Write-Host "Đã chép bản build Hosting vào firebase/public." -ForegroundColor Green
