$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$customerAppDir = Join-Path $root "customer-web"
$buildDir = Join-Path $customerAppDir "www"
$publicDir = Join-Path $root "firebase/public"

Push-Location $customerAppDir
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Customer Web build failed; Hosting output unchanged" }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $buildDir "index.html") -PathType Leaf)) {
  throw "Customer Web build is missing index.html"
}

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
