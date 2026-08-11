import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteReplayStore } from "../../src/replay/sqliteReplayStore.js";

const directories: string[] = [];
function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "haircut-gateway-replay-"));
  directories.push(directory);
  return new SqliteReplayStore(join(directory, "replay.db"));
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("SqliteReplayStore", () => {
  it("claims a nonce exactly once", () => {
    const store = createStore();
    expect(store.claim("key-a", "00112233445566778899aabbccddeeff", 2_000, 1_000)).toBe(true);
    expect(store.claim("key-a", "00112233445566778899aabbccddeeff", 2_000, 1_000)).toBe(false);
    store.close();
  });
  it("allows a nonce after its TTL was cleaned up", () => {
    const store = createStore();
    expect(store.claim("key-a", "00112233445566778899aabbccddeeff", 2_000, 1_000)).toBe(true);
    expect(store.claim("key-a", "00112233445566778899aabbccddeeff", 4_000, 3_000)).toBe(true);
    store.close();
  });
  it("keeps duplicate claims race-safe", async () => {
    const store = createStore();
    const results = await Promise.all(
      Array.from({ length: 20 }, async () =>
        store.claim("key-a", "00112233445566778899aabbccddeeff", 2_000, 1_000),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    store.close();
  });
});
