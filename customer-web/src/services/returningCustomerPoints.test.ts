import { describe, expect, it, vi } from "vitest";
import { awardReturningCustomerPoints } from "./returningCustomerPoints";
const call = vi.hoisted(() => vi.fn());
vi.mock("./firebase", () => ({ callFunction: call }));
describe("returning customer points transport", () => {
  it("uses only the authenticated callable and preserves the retry operation", async () => {
    const input = {
      salonId: "salon-a",
      branchId: "branch-a",
      customerId: "customer-a",
      phoneLast4: "5678",
      operationId: "fixture-operation-123",
    };
    call.mockResolvedValueOnce({ pointsAdded: 2 });
    expect(await awardReturningCustomerPoints(input)).toEqual({ pointsAdded: 2 });
    expect(call).toHaveBeenCalledWith("awardReturningCustomerPoints", input);
    call.mockRejectedValueOnce(new Error("fixture-denied"));
    await expect(awardReturningCustomerPoints(input)).rejects.toThrow("fixture-denied");
  });
});
