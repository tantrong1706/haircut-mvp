#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$InstallationRoot = "$env:ProgramData\CHHaircut\zalo-gateway",
  [string]$ConfigPath = "$env:ProgramData\CHHaircut\zalo-gateway\config\gateway.env",
  [int]$PortOverride = 0,
  [string]$ReplayDbPathOverride = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$logRoot = Join-Path $InstallationRoot "logs"
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$startupStatusPath = Join-Path $logRoot "startup.status.log"

function Write-StartupStage([string]$Stage) {
  if ($Stage -notmatch "^[A-Z0-9_]{2,40}$") { throw "Invalid startup stage" }
  Set-Content -LiteralPath $startupStatusPath -Value ("STAGE=" + $Stage) -Encoding ASCII
}

Write-StartupStage "BOOT"

function Assert-ChildPath([string]$Candidate, [string]$Parent) {
  $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd("\") + "\"
  $resolvedCandidate = [IO.Path]::GetFullPath($Candidate)
  if (-not $resolvedCandidate.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Release path escapes the installation root"
  }
  return $resolvedCandidate
}

function Rotate-Log([string]$Path, [long]$MaximumBytes = 10MB, [int]$Keep = 5) {
  if ((Test-Path -LiteralPath $Path) -and (Get-Item -LiteralPath $Path).Length -ge $MaximumBytes) {
    $archive = "$Path.$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss')).log"
    Move-Item -LiteralPath $Path -Destination $archive
  }
  $archives = @(Get-ChildItem -LiteralPath (Split-Path $Path) -Filter "$(Split-Path $Path -Leaf).*\.log" |
      Sort-Object LastWriteTimeUtc -Descending)
  foreach ($stale in $archives | Select-Object -Skip $Keep) {
    Remove-Item -LiteralPath $stale.FullName -Force
  }
}

$currentPath = Join-Path $InstallationRoot "current.txt"
$version = (Get-Content -LiteralPath $currentPath -Raw).Trim()
if ($version -notmatch "^[a-f0-9]{40}$") {
  throw "Invalid active gateway version"
}
Write-StartupStage "CURRENT_READY"

$releasesRoot = Join-Path $InstallationRoot "releases"
$releaseRoot = Assert-ChildPath (Join-Path $releasesRoot $version) $releasesRoot
$manifestPath = Join-Path $releaseRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
foreach ($entry in @($manifest.files)) {
  if ([string]$entry.path -notmatch "^[A-Za-z0-9._/-]+$") {
    throw "Invalid release manifest path"
  }
  $filePath = Assert-ChildPath (Join-Path $releaseRoot ([string]$entry.path)) $releaseRoot
  if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    throw "Release file is missing"
  }
  $actualHash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne [string]$entry.sha256) {
    throw "Release checksum mismatch"
  }
}
Write-StartupStage "MANIFEST_READY"

foreach ($rawLine in Get-Content -LiteralPath $ConfigPath) {
  $line = $rawLine.Trim()
  if (-not $line -or $line.StartsWith("#")) { continue }
  $separator = $line.IndexOf("=")
  if ($separator -le 0) { throw "Invalid gateway environment file" }
  $name = $line.Substring(0, $separator).Trim()
  if ($name -notmatch "^[A-Z][A-Z0-9_]{1,63}$") { throw "Invalid gateway environment name" }
  [Environment]::SetEnvironmentVariable(
    $name,
    $line.Substring($separator + 1).Trim(),
    [EnvironmentVariableTarget]::Process
  )
}
Write-StartupStage "CONFIG_READY"

if ($PortOverride -ne 0) {
  if ($PortOverride -lt 1 -or $PortOverride -gt 65535) { throw "Invalid port override" }
  $env:PORT = [string]$PortOverride
}
if ($ReplayDbPathOverride) {
  $dataRoot = Join-Path $InstallationRoot "data"
  $safeReplayPath = Assert-ChildPath $ReplayDbPathOverride $dataRoot
  New-Item -ItemType Directory -Path (Split-Path $safeReplayPath) -Force | Out-Null
  $env:REPLAY_DB_PATH = $safeReplayPath
}
Write-StartupStage "OVERRIDES_READY"

$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:ALL_PROXY = $null
$env:NO_PROXY = "*"
$env:NODE_ENV = "production"
$env:GATEWAY_VERSION = $version
$env:NODE_NO_WARNINGS = "1"

$nodePath = Join-Path $releaseRoot "bin\node.exe"
$serverPath = Join-Path $releaseRoot "app\dist\src\server.js"
if ((& $nodePath --version).Trim() -notmatch "^v22\.") {
  throw "Gateway release must use Node.js 22"
}
Write-StartupStage "NODE_READY"

$stdoutPath = Join-Path $logRoot "gateway.stdout.log"
$stderrPath = Join-Path $logRoot "gateway.stderr.log"
Rotate-Log $stdoutPath
Rotate-Log $stderrPath

Set-Location -LiteralPath (Join-Path $releaseRoot "app")
Write-StartupStage "START_NODE"
& $nodePath $serverPath 1>> $stdoutPath 2>> $stderrPath
$nodeExitCode = $LASTEXITCODE
Write-StartupStage "NODE_EXIT"
exit $nodeExitCode
