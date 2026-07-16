import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requiredTenantCollections = [
  "branches",
  "customers",
  "chair_sessions",
  "active_service_sessions",
  "point_requests",
  "haircut_records",
  "reward_history",
  "audit_events",
  "device_tokens",
  "support_requests",
];

describe("inventory migration tenant", () => {
  it("kiểm tra mọi collection nghiệp vụ bắt buộc có salonId", () => {
    const inventory = JSON.parse(
      readFileSync(resolve(process.cwd(), "scripts", "tenant-collections.json"), "utf8"),
    ) as string[];

    expect(inventory).toEqual(requiredTenantCollections);
    expect(new Set(inventory).size).toBe(inventory.length);
  });
});
