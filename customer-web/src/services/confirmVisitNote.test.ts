import { beforeEach, describe, expect, it, vi } from "vitest";
const call = vi.hoisted(() => vi.fn());
vi.mock("./firebase", () => ({ callFunction: call, isFirebaseConfigured: () => true }));
import { confirmCustomerPointRequest, type StaffSession } from "./operations";
const session = { id: "request-note-fixture" } as StaffSession;
describe("confirmation preserves a saved visit note", () => {
  beforeEach(() => vi.clearAllMocks());
  it("omits an untouched note instead of replacing it with empty text", async () => {
    await confirmCustomerPointRequest({ salonId: "salon-fixture", session, photoPaths: [] });
    expect(call).toHaveBeenCalledWith("approvePointRequest", {
      salonId: "salon-fixture",
      requestId: session.id,
      photoPaths: [],
    });
  });
  it("still permits intentionally clearing the note", async () => {
    await confirmCustomerPointRequest({
      salonId: "salon-fixture",
      session,
      photoPaths: [],
      note: "",
    });
    expect(call).toHaveBeenCalledWith("approvePointRequest", {
      salonId: "salon-fixture",
      requestId: session.id,
      photoPaths: [],
      note: "",
    });
  });
});
