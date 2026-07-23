import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAdminFunction } from "./firebase";
import { adminApi } from "./adminApi";

vi.mock("./firebase", () => ({ callAdminFunction: vi.fn() }));

const mockedCall = vi.mocked(callAdminFunction);

describe("adminApi", () => {
  beforeEach(() => mockedCall.mockReset());

  it("giới hạn trang danh sách salon và gọi đúng callable", async () => {
    mockedCall.mockResolvedValueOnce({ salons: [], nextCursor: null });

    await adminApi.salons("cursor-a");

    expect(mockedCall).toHaveBeenCalledWith("listSystemAdminSalons", {
      cursor: "cursor-a",
      pageSize: 50,
    });
  });

  it("không xuất bất kỳ thao tác ghi nào trong bản read-only", () => {
    expect(Object.keys(adminApi)).toEqual(["overview", "salons", "features", "auditEvents"]);
  });
});
