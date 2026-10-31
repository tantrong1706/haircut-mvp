import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ customer: vi.fn(), manager: vi.fn() }));
vi.mock("./firebase", () => ({ callCustomerWebFunction: mocks.customer, callFunction: mocks.manager }));
import { updateOwnCustomerName } from "./customerName";
const input = { salonId: "salon-a", customerId: "customer-a", name: " Anh Minh ", expectedName: "Khách 4567" };
beforeEach(() => { vi.clearAllMocks(); mocks.customer.mockResolvedValue({ customerId: "customer-a", name: "Anh Minh" }); });
describe("customer self-service name adapter", () => {
  it("uses customer Auth and never sends a target customer, UID, phone, points or request ID", async () => {
    expect(await updateOwnCustomerName({ ...input, pointRequestId: "ignored" })).toEqual({ customerId: "customer-a", name: "Anh Minh" });
    expect(mocks.customer).toHaveBeenCalledWith("updateWebCustomerName", { salonId: "salon-a", name: "Anh Minh", expectedName: "Khách 4567" });
    expect(mocks.manager).not.toHaveBeenCalled();
  });
  it.each(["", " ", "x".repeat(81), "Bad\u0000name"])("rejects invalid name %s without a remote call", async name => {
    await expect(updateOwnCustomerName({ ...input, name })).rejects.toThrow();
    expect(mocks.customer).not.toHaveBeenCalled();
  });
  it("rejects a server result for another identity or a missing result", async () => {
    for (const result of [null, { customerId: "other", name: "Other" }, { customerId: "customer-a", name: "" }]) {
      mocks.customer.mockResolvedValueOnce(result);
      await expect(updateOwnCustomerName(input)).rejects.toThrow();
    }
  });
  it("keeps server normalization and surfaces permission/stale errors", async () => {
    mocks.customer.mockResolvedValueOnce({ customerId: "customer-a", name: "Tên chuẩn" });
    expect((await updateOwnCustomerName(input)).name).toBe("Tên chuẩn");
    mocks.customer.mockRejectedValueOnce(new Error("Tên đã thay đổi"));
    await expect(updateOwnCustomerName(input)).rejects.toThrow("Tên đã thay đổi");
  });
});
