import { describe, expect, it } from "vitest";
import { customerSessionRefreshDelay } from "./api";

describe("customerSessionRefreshDelay", () => {
  it("dừng polling khi lượt đã kết thúc", () => {
    expect(customerSessionRefreshDelay("completed", 0, 0)).toBeNull();
    expect(customerSessionRefreshDelay("cancelled", 0, 0)).toBeNull();
  });

  it("giảm tần suất khi chờ duyệt và backoff sau lỗi", () => {
    expect(customerSessionRefreshDelay("waiting", 0, 0)).toBe(20_000);
    expect(customerSessionRefreshDelay("pending_approval", 0, 0)).toBe(30_000);
    expect(customerSessionRefreshDelay("waiting", 2, 0)).toBe(80_000);
  });
});
