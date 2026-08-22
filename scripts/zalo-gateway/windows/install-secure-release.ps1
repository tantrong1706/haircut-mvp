#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [Parameter(Mandatory = $true)][string]$ConfigSource,
  [string]$NodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source,
  [string]$InstallationRoot = "$env:ProgramData\CHHaircut\zalo-gateway",
  [string]$ServiceRoot = "$env:ProgramData\CHHaircut\gateway-service",
  [string]$Version = "",
  [switch]$Activate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$serviceName = "CHHaircutZaloGateway"
$serviceSid = "NT SERVICE\CHHaircutZaloGateway"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerSource = Join-Path $scriptRoot "run-secure-gateway.ps1"

function Invoke-Native([string]$FilePath, [string[]]$Arguments) {
  & $FilePath @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Native command failed: $FilePath (exit $LASTEXITCODE)"
  }
}

function Set-DirectoryAcl([string]$Path, [string]$ServiceAccess) {
  Invoke-Native icacls.exe @(
    $Path,
    "/inheritance:r",
    "/grant:r",
    "SYSTEM:(OI)(CI)(F)",
    "BUILTIN\Administrators:(OI)(CI)(F)",
    ("{0}:(OI)(CI)({1})" -f $serviceSid, $ServiceAccess)
  )
}

function Set-FileAcl([string]$Path, [string]$ServiceAccess) {
  Invoke-Native icacls.exe @(
    $Path,
    "/inheritance:r",
    "/grant:r",
    "SYSTEM:(F)",
    "BUILTIN\Administrators:(F)",
    ("{0}:({1})" -f $serviceSid, $ServiceAccess)
  )
}

function Wait-LocalHealth([int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/health" -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) { return }
    } catch {
      Start-Sleep -Milliseconds 750
    }
  } while ((Get-Date) -lt $deadline)
  throw "Gateway health did not become ready"
}

$source = (Resolve-Path -LiteralPath $SourceRoot).Path
$config = (Resolve-Path -LiteralPath $ConfigSource).Path
if (-not (Test-Path -LiteralPath (Join-Path $source "dist\src\server.js"))) {
  throw "Build the gateway before installing a release"
}
if (@(git -C $source status --porcelain).Count -ne 0) {
  throw "Gateway source worktree must be clean"
}
$headSha = (git -C $source rev-parse HEAD).Trim()
if ($headSha -notmatch "^[a-f0-9]{40}$") { throw "Invalid source SHA" }
if (-not $Version) { $Version = $headSha }
if ($Version -ne $headSha) { throw "Version must equal the clean Git HEAD" }
if ((& $NodeExecutable --version).Trim() -notmatch "^v22\.") {
  throw "Node.js 22 is required"
}

$releasesRoot = Join-Path $InstallationRoot "releases"
$stagingRoot = Join-Path $InstallationRoot "staging"
$releaseRoot = Join-Path $releasesRoot $Version
$configRoot = Join-Path $InstallationRoot "config"
$dataRoot = Join-Path $InstallationRoot "data"
$logRoot = Join-Path $InstallationRoot "logs"
$runnerTarget = Join-Path $InstallationRoot "run-secure-gateway.ps1"
$currentPath = Join-Path $InstallationRoot "current.txt"
$secureConfigPath = Join-Path $configRoot "gateway.env"
$previousVersion = if (Test-Path -LiteralPath $currentPath) {
  (Get-Content -LiteralPath $currentPath -Raw).Trim()
} else {
  ""
}

if (Test-Path -LiteralPath $releaseRoot) {
  throw "Release already exists: $Version"
}

$staging = Join-Path $stagingRoot ([Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path (Join-Path $staging "app") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $source "dist") -Destination (Join-Path $staging "app") -Recurse
Copy-Item -LiteralPath (Join-Path $source "package.json") -Destination (Join-Path $staging "app")
Copy-Item -LiteralPath (Join-Path $source "package-lock.json") -Destination (Join-Path $staging "app")
New-Item -ItemType Directory -Path (Join-Path $staging "bin") -Force | Out-Null
Copy-Item -LiteralPath $NodeExecutable -Destination (Join-Path $staging "bin\node.exe")

$files = @(
  Get-ChildItem -LiteralPath $staging -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
      [ordered]@{
        path = $_.FullName.Substring($staging.Length + 1).Replace("\", "/")
        size = $_.Length
        sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      }
    }
)
[ordered]@{
  schemaVersion = 1
  version = $Version
  createdAtUtc = [DateTime]::UtcNow.ToString("o")
  files = $files
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $staging "manifest.json") -Encoding UTF8

New-Item -ItemType Directory -Path $releasesRoot, $configRoot, $dataRoot, $logRoot -Force | Out-Null
Set-DirectoryAcl $staging "RX"
Set-DirectoryAcl $configRoot "RX"
Set-DirectoryAcl $dataRoot "M"
Set-DirectoryAcl $logRoot "M"

if ($PSCmdlet.ShouldProcess($releaseRoot, "Install immutable gateway release")) {
  Move-Item -LiteralPath $staging -Destination $releaseRoot
  Copy-Item -LiteralPath $runnerSource -Destination $runnerTarget -Force
  Copy-Item -LiteralPath $config -Destination $secureConfigPath -Force
  Set-FileAcl $runnerTarget "RX"
  Set-FileAcl $secureConfigPath "R"

  $currentTemp = Join-Path $InstallationRoot "current.txt.new"
  Set-Content -LiteralPath $currentTemp -Value $Version -Encoding ASCII
  Set-FileAcl $currentTemp "R"
  Move-Item -LiteralPath $currentTemp -Destination $currentPath -Force
}

if (-not $Activate) {
  Write-Output "SECURE_GATEWAY_RELEASE_PREPARED=true"
  Write-Output "SECURE_GATEWAY_ACTIVATED=false"
  exit 0
}

$wrapper = Join-Path $ServiceRoot "$serviceName.exe"
$xmlPath = Join-Path $ServiceRoot "$serviceName.xml"
if (-not (Test-Path -LiteralPath $wrapper)) { throw "WinSW wrapper was not found" }
$previousXml = if (Test-Path -LiteralPath $xmlPath) { Get-Content -LiteralPath $xmlPath -Raw } else { "" }

$xml = @"
<service>
  <id>$serviceName</id>
  <name>CH Haircut Zalo Gateway</name>
  <description>CH Haircut Salon Vietnam verification gateway</description>
  <executable>C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe</executable>
  <arguments>-NoProfile -NonInteractive -ExecutionPolicy Bypass -File &quot;$runnerTarget&quot;</arguments>
  <workingdirectory>$InstallationRoot</workingdirectory>
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
  <onfailure action="restart" delay="10 sec" />
  <onfailure action="restart" delay="30 sec" />
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>20 sec</stoptimeout>
  <log mode="none" />
</service>
"@

try {
  Set-Content -LiteralPath $xmlPath -Value $xml -Encoding UTF8
  Set-FileAcl $xmlPath "R"
  Invoke-Native $wrapper @("stop")
  Invoke-Native $wrapper @("uninstall")
  Invoke-Native $wrapper @("install")
  Invoke-Native $wrapper @("start")
  Wait-LocalHealth
} catch {
  if ($previousXml) { Set-Content -LiteralPath $xmlPath -Value $previousXml -Encoding UTF8 }
  if ($previousVersion -match "^[a-f0-9]{40}$") {
    Set-Content -LiteralPath $currentPath -Value $previousVersion -Encoding ASCII
  }
  & $wrapper stop | Out-Null
  & $wrapper uninstall | Out-Null
  & $wrapper install | Out-Null
  & $wrapper start | Out-Null
  throw
}

Write-Output "SECURE_GATEWAY_RELEASE_PREPARED=true"
Write-Output "SECURE_GATEWAY_ACTIVATED=true"
Write-Output "GATEWAY_VERSION=$Version"
