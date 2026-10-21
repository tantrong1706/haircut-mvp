import { beforeEach, describe, expect, it, vi } from "vitest";
const call = vi.hoisted(() => vi.fn());
vi.mock("./firebase", () => ({ callFunction: call }));
import { listSalonCustomerDirectory, savePendingVisitNote } from "./ownerWorkspace";
describe("owner workspace transport", () => {
  beforeEach(() => vi.clearAllMocks());
  it("requests an explicit owner-only paged directory", async () => {
    call.mockResolvedValue({ customers: [], totalCount: 0, nextCursor: null });
    expect(await listSalonCustomerDirectory({ salonId: "salon-fixture" })).toMatchObject({
      totalCount: 0,
    });
    expect(call).toHaveBeenCalledWith("searchSalonCustomers", {
      salonId: "salon-fixture",
      directory: true,
      pageSize: 10,
    });
    await listSalonCustomerDirectory({ salonId: "salon-fixture", cursor: "next-fixture" });
    expect(call).toHaveBeenLastCalledWith("searchSalonCustomers", {
      salonId: "salon-fixture",
      directory: true,
      pageSize: 10,
      cursor: "next-fixture",
    });
  });
  it("sends only the note; never sends empty photo arrays", async () => {
    await savePendingVisitNote({
      salonId: "salon-fixture",
      requestId: "request-fixture",
      note: "Giữ form",
    });
    expect(call).toHaveBeenCalledWith("updatePendingPointRequestPhotos", {
      salonId: "salon-fixture",
      requestId: "request-fixture",
      note: "Giữ form",
    });
  });
  it("preserves permission errors without a direct write fallback", async () => {
    call.mockRejectedValue(new Error("Denied fixture"));
    await expect(
      savePendingVisitNote({ salonId: "salon-fixture", requestId: "request-fixture", note: "" }),
    ).rejects.toThrow("Denied fixture");
  });
});
