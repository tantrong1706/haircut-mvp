import { describe, expect, it } from "vitest";
import { ADMIN_WRITE_ACTIONS_ENABLED, READ_ONLY_ADMIN_TABS } from "./adminCapabilities";

describe("Admin read-only", () => {
  it("không có tab vận hành ghi và luôn tắt hành động ghi", () => {
    expect(ADMIN_WRITE_ACTIONS_ENABLED).toBe(false);
    expect(READ_ONLY_ADMIN_TABS.map((tab) => tab.id)).toEqual([
      "overview",
      "salons",
      "features",
      "audit",
    ]);
  });
});
