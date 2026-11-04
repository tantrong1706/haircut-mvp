import { describe, expect, it, vi } from "vitest";
import { deleteCustomerData } from "./operations";
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./firebase", () => ({
  callFunction: mocks.call,
  isFirebaseConfigured: () => true,
  getFirebaseDb: () => null,
  getFirebaseAuth: () => null,
}));
describe("customer deletion generation", () => {
  it("sends the profile creation version selected by the owner", async () => {
    mocks.call.mockResolvedValue({ status: "completed" });
    await deleteCustomerData({
      salonId: "salon-a",
      customerId: "customer-a",
      expectedCreatedAtMs: 1_700_000_000_000,
    } as never);
    expect(mocks.call).toHaveBeenCalledWith("deleteCustomerData", {
      salonId: "salon-a",
      customerId: "customer-a",
      expectedCreatedAtMs: 1_700_000_000_000,
    });
  });
});
