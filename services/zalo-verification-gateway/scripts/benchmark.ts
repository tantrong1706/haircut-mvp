import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { performance } from "node:perf_hooks";
import { createGatewayApplication } from "../src/app.js";
import { createSafeLogger } from "../src/observability/safeLogger.js";
import { SqliteReplayStore } from "../src/replay/sqliteReplayStore.js";
import { buildCanonicalRequest, sha256Hex } from "../src/security/signature.js";

const directory = mkdtempSync(join(tmpdir(), "haircut-gateway-benchmark-"));
const keyHex = "44".repeat(32);
const application = createGatewayApplication({
  keys: new Map([
    ["steady", keyHex],
    ["burst", keyHex],
  ]),
  replayStore: new SqliteReplayStore(join(directory, "replay.db")),
  fetchImpl: async () => new Response(JSON.stringify({ id: "123456789" }), { status: 200 }),
  logger: createSafeLogger(() => undefined),
});

await new Promise<void>((resolve) => application.server.listen(0, "127.0.0.1", resolve));
const address = application.server.address() as AddressInfo;
const endpoint = `http://127.0.0.1:${address.port}/v1/zalo/verify`;
const latencies: number[] = [];
const cpuStart = process.cpuUsage();
const memoryStart = process.memoryUsage().rss;

try {
  for (let index = 0; index < 20; index += 1) {
    await request("steady", `req_bench_steady_${index}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const burst = await Promise.all(
    Array.from({ length: 50 }, (_, index) => request("burst", `req_bench_burst_${index}`)),
  );
  if (burst.some((status) => status !== 200)) throw new Error("Synthetic burst failed");
  const cpu = process.cpuUsage(cpuStart);
  const sorted = [...latencies].sort((left, right) => left - right);
  const percentile = (value: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))];
  console.log(
    JSON.stringify(
      {
        kind: "local-synthetic-benchmark",
        steadyRequestsPerSecond: 20,
        burstRequests: 50,
        totalRequests: latencies.length,
        latencyMs: {
          p50: Number(percentile(0.5).toFixed(2)),
          p95: Number(percentile(0.95).toFixed(2)),
          max: Number(sorted.at(-1)!.toFixed(2)),
        },
        cpuMs: Number(((cpu.user + cpu.system) / 1_000).toFixed(2)),
        rssDeltaBytes: process.memoryUsage().rss - memoryStart,
        productionCapacityClaimed: false,
      },
      null,
      2,
    ),
  );
} finally {
  await application.close();
  rmSync(directory, { recursive: true, force: true });
}

async function request(keyId: string, requestId: string) {
  const body = JSON.stringify({
    accessToken: "benchmark-token",
    appsecretProof: "a".repeat(64),
    requestId,
  });
  const timestamp = String(Date.now());
  const nonce = randomBytes(16).toString("hex");
  const bodySha256 = sha256Hex(Buffer.from(body));
  const canonical = buildCanonicalRequest({
    method: "POST",
    path: "/v1/zalo/verify",
    timestamp,
    nonce,
    requestId,
    bodySha256,
  });
  const started = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-key-id": keyId,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
      "x-request-id": requestId,
      "x-body-sha256": bodySha256,
      "x-signature": createHmac("sha256", Buffer.from(keyHex, "hex"))
        .update(canonical)
        .digest("hex"),
    },
    body,
  });
  latencies.push(performance.now() - started);
  return response.status;
}
