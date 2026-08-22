#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [Parameter(Mandatory = $true)][string]$ConfigSource,
  [string]$NodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source,
  [string]$InstallationRoot = "$env:ProgramData\CHHaircut\zalo-gateway",
  [string]$ServiceRoot = "$env:ProgramData\CHHaircut\gateway-service",
  [string]$ServiceRunnerPath = "",
  [string]$Version = "",
  [switch]$Activate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$serviceName = "CHHaircutZaloGateway"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerSource = Join-Path $scriptRoot "run-secure-gateway.ps1"

function Invoke-Native([string]$FilePath, [string[]]$Arguments) {
  & $FilePath @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Native command failed: $FilePath (exit $LASTEXITCODE)"
  }
}

function Invoke-GitText([string]$RepositoryRoot, [string[]]$Arguments) {
  $output = @(
    & git -c ("safe.directory=" + $RepositoryRoot) -C $RepositoryRoot @Arguments 2>&1
  )
  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed"
  }
  return ($output -join [Environment]::NewLine).Trim()
}

function Resolve-ServiceSid([string]$AccountName) {
  try {
    $account = [Security.Principal.NTAccount]::new($AccountName)
    return $account.Translate([Security.Principal.SecurityIdentifier]).Value
  } catch [Security.Principal.IdentityNotMappedException] {
    return ""
  }
}

$serviceSid = Resolve-ServiceSid "NT SERVICE\CHHaircutZaloGateway"

function Set-DirectoryAcl([string]$Path, [string]$ServiceAccess) {
  $arguments = @(
    $Path,
    "/inheritance:r",
    "/grant:r",
    "SYSTEM:(OI)(CI)(F)",
    "BUILTIN\Administrators:(OI)(CI)(F)"
  )
  if ($serviceSid) { $arguments += ("*{0}:(OI)(CI)({1})" -f $serviceSid, $ServiceAccess) }
  Invoke-Native icacls.exe $arguments
}

function Set-FileAcl([string]$Path, [string]$ServiceAccess) {
  $arguments = @(
    $Path,
    "/inheritance:r",
    "/grant:r",
    "SYSTEM:(F)",
    "BUILTIN\Administrators:(F)"
  )
  if ($serviceSid) { $arguments += ("*{0}:({1})" -f $serviceSid, $ServiceAccess) }
  Invoke-Native icacls.exe $arguments
}

function Get-GatewayEnvironmentValue([string]$Path, [string]$VariableName) {
  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) { continue }
    $separator = $line.IndexOf("=")
    if ($separator -le 0) { throw "Invalid gateway environment file" }
    if ($line.Substring(0, $separator).Trim() -eq $VariableName) {
      return $line.Substring($separator + 1).Trim()
    }
  }
  return ""
}

function Copy-ReplayDatabase([string]$SourcePath, [string]$DestinationPath) {
  if (-not $SourcePath) { return }
  $resolvedSource = [IO.Path]::GetFullPath($SourcePath)
  $resolvedDestination = [IO.Path]::GetFullPath($DestinationPath)
  if ($resolvedSource -eq $resolvedDestination -or
      (Test-Path -LiteralPath $resolvedDestination -PathType Leaf)) {
    return
  }
  if (-not (Test-Path -LiteralPath $resolvedSource -PathType Leaf)) { return }

  foreach ($suffix in @("", "-wal", "-shm")) {
    $sourceFile = $resolvedSource + $suffix
    if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
      $destinationFile = $resolvedDestination + $suffix
      Copy-Item -LiteralPath $sourceFile -Destination $destinationFile
      Set-FileAcl $destinationFile "M"
    }
  }
}

function Assert-InstalledRelease([string]$ReleaseRoot, [string]$ExpectedVersion) {
  $manifestPath = Join-Path $ReleaseRoot "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Existing release manifest is missing"
  }

  try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  } catch {
    throw "Existing release manifest is invalid"
  }

  $propertyNames = @($manifest.PSObject.Properties.Name)
  if (-not ($propertyNames -contains "schemaVersion") -or $manifest.schemaVersion -ne 1) {
    throw "Existing release manifest schema is invalid"
  }
  if (-not ($propertyNames -contains "version") -or $manifest.version -ne $ExpectedVersion) {
    throw "Existing release version does not match"
  }
  if (-not ($propertyNames -contains "files") -or @($manifest.files).Count -eq 0) {
    throw "Existing release manifest file list is empty"
  }

  $rootPrefix = [IO.Path]::GetFullPath($ReleaseRoot).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
  $listedPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in @($manifest.files)) {
    $fileProperties = @($file.PSObject.Properties.Name)
    if (-not ($fileProperties -contains "path") -or
        -not ($fileProperties -contains "size") -or
        -not ($fileProperties -contains "sha256")) {
      throw "Existing release manifest contains an invalid file entry"
    }

    $relativePath = [string]$file.path
    if ($relativePath -notmatch "^[A-Za-z0-9._/-]+$" -or
        $relativePath.StartsWith("/") -or
        $relativePath -match "(^|/)\.\.($|/)") {
      throw "Existing release manifest contains an unsafe path"
    }
    if (-not $listedPaths.Add($relativePath)) {
      throw "Existing release manifest contains a duplicate path"
    }

    $candidatePath = [IO.Path]::GetFullPath((Join-Path $ReleaseRoot $relativePath.Replace("/", "\")))
    if (-not $candidatePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Existing release manifest path escapes the release root"
    }
    if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
      throw "Existing release file is missing"
    }

    $candidate = Get-Item -LiteralPath $candidatePath
    if ($candidate.Length -ne [long]$file.size) {
      throw "Existing release file size does not match"
    }
    $actualHash = (Get-FileHash -LiteralPath $candidatePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne ([string]$file.sha256).ToLowerInvariant()) {
      throw "Existing release file checksum does not match"
    }
  }

  $installedFiles = @(
    Get-ChildItem -LiteralPath $ReleaseRoot -Recurse -File |
      Where-Object { $_.FullName -ne $manifestPath }
  )
  if ($installedFiles.Count -ne $listedPaths.Count) {
    throw "Existing release contains unmanifested files"
  }
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
$repoRoot = [IO.Path]::GetFullPath((Join-Path $source "..\.."))
if (-not (Test-Path -LiteralPath (Join-Path $source "dist\src\server.js"))) {
  throw "Build the gateway before installing a release"
}
if (Invoke-GitText $repoRoot @("status", "--porcelain")) {
  throw "Gateway source worktree must be clean"
}
$headSha = Invoke-GitText $repoRoot @("rev-parse", "HEAD")
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
$configuredReplayDbPath = Get-GatewayEnvironmentValue $config "REPLAY_DB_PATH"
$secureReplayDbPath = Join-Path $dataRoot "replay.db"
$previousVersion = if (Test-Path -LiteralPath $currentPath) {
  (Get-Content -LiteralPath $currentPath -Raw).Trim()
} else {
  ""
}

New-Item -ItemType Directory -Path $releasesRoot, $configRoot, $dataRoot, $logRoot -Force | Out-Null
$reuseExistingRelease = Test-Path -LiteralPath $releaseRoot
if ($reuseExistingRelease) {
  Assert-InstalledRelease $releaseRoot $Version
  Write-Output "REUSE_EXISTING_RELEASE=true"
} else {
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
  Set-DirectoryAcl $staging "RX"
}

Set-DirectoryAcl $configRoot "RX"
Set-DirectoryAcl $dataRoot "M"
Set-DirectoryAcl $logRoot "M"

if ($PSCmdlet.ShouldProcess($releaseRoot, "Install immutable gateway release")) {
  if (-not $reuseExistingRelease) {
    Move-Item -LiteralPath $staging -Destination $releaseRoot
  }
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
if (-not $ServiceRunnerPath) { throw "ServiceRunnerPath is required for activation" }
$serviceRunnerPath = (Resolve-Path -LiteralPath $ServiceRunnerPath).Path
if ((Split-Path $serviceRunnerPath -Leaf) -ne "run-gateway.ps1") {
  throw "Unexpected service runner filename"
}
$serviceXml = if (Test-Path -LiteralPath $xmlPath) { Get-Content -LiteralPath $xmlPath -Raw } else { "" }
if (-not $serviceXml -or $serviceXml -notlike "*$serviceRunnerPath*") {
  throw "WinSW is not configured for the expected service runner"
}
$previousRunner = Get-Content -LiteralPath $serviceRunnerPath -Raw
$serviceWasInstalled = $null -ne (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)

try {
  Copy-Item -LiteralPath $runnerSource -Destination $serviceRunnerPath -Force
  Set-FileAcl $serviceRunnerPath "RX"
  if (-not $serviceWasInstalled) {
    Invoke-Native $wrapper @("install")
  } else {
    Invoke-Native $wrapper @("stop")
  }
  Copy-ReplayDatabase $configuredReplayDbPath $secureReplayDbPath
  Invoke-Native $wrapper @("start")
  Wait-LocalHealth
} catch {
  Set-Content -LiteralPath $serviceRunnerPath -Value $previousRunner -Encoding UTF8
  Set-FileAcl $serviceRunnerPath "RX"
  if ($previousVersion -match "^[a-f0-9]{40}$") {
    Set-Content -LiteralPath $currentPath -Value $previousVersion -Encoding ASCII
  }
  & $wrapper stop | Out-Null
  & $wrapper start | Out-Null
  throw
}

Write-Output "SECURE_GATEWAY_RELEASE_PREPARED=true"
Write-Output "SECURE_GATEWAY_ACTIVATED=true"
Write-Output "GATEWAY_VERSION=$Version"
