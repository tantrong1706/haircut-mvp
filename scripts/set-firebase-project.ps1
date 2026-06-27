param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebaseDir = Join-Path $root "firebase"
$firebaserc = Join-Path $firebaseDir ".firebaserc"

$json = @{
  projects = @{
    default = $ProjectId
  }
} | ConvertTo-Json -Depth 5

Set-Content -LiteralPath $firebaserc -Value $json -Encoding UTF8

Write-Host "Firebase project set to: $ProjectId" -ForegroundColor Green
Write-Host "File written: $firebaserc"

