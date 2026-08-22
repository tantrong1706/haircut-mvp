import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), "utf8");

describe("deployment templates", () => {
  it("runs the service as a dedicated non-root user with constrained write access", () => {
    const service = read("deploy/zalo-gateway/zalo-gateway.service");
    expect(service).toContain("User=zalo-gateway");
    expect(service).toContain("Group=zalo-gateway");
    expect(service).toContain("NoNewPrivileges=true");
    expect(service).toContain("ProtectSystem=strict");
    expect(service).toContain("ReadWritePaths=/var/lib/zalo-gateway");
    expect(service).not.toContain("User=root");
  });

  it("keeps the gateway private behind Caddy and strips access-log headers", () => {
    const caddy = read("deploy/zalo-gateway/Caddyfile");
    expect(caddy).toContain("GATEWAY_FQDN");
    expect(caddy).toContain("reverse_proxy 127.0.0.1:3000");
    expect(caddy).toContain("request>headers delete");
    expect(caddy).toContain("max_size 8KB");
  });

  it("does not embed production credentials or infrastructure addresses", () => {
    const files = [
      read("deploy/zalo-gateway/gateway.env.example"),
      read("scripts/zalo-gateway/bootstrap-ubuntu.sh"),
      read("scripts/zalo-gateway/deploy-release.sh"),
    ].join("\n");
    expect(files).not.toMatch(/BEGIN (?:OPENSSH|RSA|EC) PRIVATE KEY/u);
    expect(files).not.toMatch(/(?:password|token)\s*=\s*[^\s#]+/iu);
    const addresses = files.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu) ?? [];
    expect(addresses.every((address) => address === "127.0.0.1")).toBe(true);
  });

  it("installs an immutable checksummed Windows release outside the development repo", () => {
    const installer = read("scripts/zalo-gateway/windows/install-secure-release.ps1");
    const runner = read("scripts/zalo-gateway/windows/run-secure-gateway.ps1");
    expect(installer).toContain("ProgramData\\CHHaircut\\zalo-gateway");
    expect(installer).toContain('Join-Path $InstallationRoot "releases"');
    expect(installer).toContain("Get-FileHash");
    expect(installer).toContain('Invoke-GitText $repoRoot @("status", "--porcelain")');
    expect(installer).toContain("icacls.exe");
    expect(installer).toContain("NT SERVICE\\CHHaircutZaloGateway");
    expect(installer).not.toContain("Authenticated Users");
    expect(installer).toContain("safe.directory=");
    expect(installer).toContain("function Invoke-GitText");
    expect(installer).not.toMatch(/\(git -C \$source rev-parse HEAD\)\.Trim/u);
    expect(installer).toContain("$ServiceRunnerPath");
    expect(installer).toContain(
      "Copy-Item -LiteralPath $runnerSource -Destination $serviceRunnerPath",
    );
    expect(installer).toContain("$previousRunner");
    expect(installer).toContain("function Resolve-ServiceSid");
    expect(installer).toContain("IdentityNotMappedException");
    expect(installer).toContain("if ($serviceSid)");
    expect(installer).toContain("function Assert-InstalledRelease");
    expect(installer).toContain("Assert-InstalledRelease $releaseRoot $Version");
    expect(installer).toContain("REUSE_EXISTING_RELEASE=true");
    expect(installer).not.toContain('throw "Release already exists: $Version"');
    expect(installer).toContain("Get-Service -Name $serviceName -ErrorAction SilentlyContinue");
    expect(installer).toContain("if (-not $serviceWasInstalled)");
    expect(installer).toContain('Invoke-Native $wrapper @("install")');
    expect(installer).toContain("function Copy-ReplayDatabase");
    expect(installer).toContain("Copy-ReplayDatabase $configuredReplayDbPath $secureReplayDbPath");
    expect(installer).not.toContain('Invoke-Native $wrapper @("uninstall")');
    expect(installer).not.toContain("Set-Content -LiteralPath $xmlPath");
    expect(runner).toContain("current.txt");
    expect(runner).toContain("manifest.json");
    expect(runner).toContain("Get-FileHash");
    expect(runner).toContain("dist\\src\\server.js");
    expect(runner).toContain("$PortOverride");
    expect(runner).toContain("$ReplayDbPathOverride");
    expect(runner).toContain('$env:REPLAY_DB_PATH = Join-Path $InstallationRoot "data\\replay.db"');
    expect(runner).toContain("startup.status.log");
    expect(runner).toContain('Write-StartupStage "START_NODE"');
    expect(runner).toContain("[IO.Path]::GetFileName($Path)");
    expect(runner).not.toContain('Filter "$(Split-Path $Path -Leaf).*\\.log"');
    expect(installer).toContain(
      "[IO.File]::Replace($currentTemp, $currentPath, $currentBackup, $true)",
    );
    expect(installer).toContain("$currentBackup = Join-Path $InstallationRoot");
    expect(installer).toContain("Remove-Item -LiteralPath $currentBackup -Force");
    expect(installer).not.toContain(
      "Move-Item -LiteralPath $currentTemp -Destination $currentPath -Force",
    );
    expect(installer.indexOf("$previousVersion =")).toBeLessThan(
      installer.indexOf("[IO.File]::Replace($currentTemp, $currentPath, $currentBackup, $true)"),
    );
    expect(installer.indexOf('Invoke-Native $wrapper @("stop")')).toBeLessThan(
      installer.indexOf("Copy-ReplayDatabase $configuredReplayDbPath $secureReplayDbPath"),
    );
    expect(
      installer.indexOf("Copy-ReplayDatabase $configuredReplayDbPath $secureReplayDbPath"),
    ).toBeLessThan(installer.indexOf('Invoke-Native $wrapper @("start")'));
  });
});
