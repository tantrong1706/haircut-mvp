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
});
