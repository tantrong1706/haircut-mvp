import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./firebase", () => ({ callFunction: mocks.call }));
import { updateCustomerName } from "./customerName";
const input = { salonId: "salon-a", customerId: "customer-a", name: "Anh Minh", expectedName: "Khách 1028" };
beforeEach(() => { vi.clearAllMocks(); mocks.call.mockResolvedValue({ customerId: "customer-a", name: "Anh Minh" }); });
describe("authenticated customer name adapter", () => {
  it("sends only the selected customer, display name and stale-edit guard", async () => {
    expect(await updateCustomerName(input)).toEqual({ customerId: "customer-a", name: "Anh Minh" });
    expect(mocks.call).toHaveBeenCalledWith("updateSalonCustomerName", input);
  });
  it("includes the staff pending-request scope without changing customer identity", async () => {
    await updateCustomerName({ ...input, pointRequestId: "request-a" });
    expect(mocks.call).toHaveBeenCalledWith("updateSalonCustomerName", { ...input, pointRequestId: "request-a" });
  });
  it.each([" ", "x".repeat(81)])("rejects an invalid name before calling the server", async name => {
    await expect(updateCustomerName({ ...input, name })).rejects.toThrow();
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it("does not accept a response belonging to another customer", async () => {
    mocks.call.mockResolvedValue({ customerId: "customer-b", name: "Anh Minh" });
    await expect(updateCustomerName(input)).rejects.toThrow();
  });
  it("does not report a missing server result as saved", async () => {
    mocks.call.mockResolvedValue(null);
    await expect(updateCustomerName(input)).rejects.toThrow();
  });
  it("retains the server's normalized name and propagates denied operations", async () => {
    mocks.call.mockResolvedValueOnce({ customerId: "customer-a", name: "Tên từ máy chủ" });
    expect((await updateCustomerName(input)).name).toBe("Tên từ máy chủ");
    mocks.call.mockRejectedValueOnce(new Error("Không được phép đổi tên"));
    await expect(updateCustomerName(input)).rejects.toThrow("Không được phép đổi tên");
  });
});
