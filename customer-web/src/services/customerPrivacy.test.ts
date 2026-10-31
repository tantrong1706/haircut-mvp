import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withdrawCustomerPhotoPermission } from "./customerPrivacy";
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./firebase", () => ({ callCustomerWebFunction: mocks.call }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_APP_ENV", "production");
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as typeof window & { __haircutWebAuthTestMode?: boolean })
    .__haircutWebAuthTestMode;
});
describe("customer privacy API", () => {
  it("limits the local fake to the explicit test environment", async () => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
    vi.stubEnv("VITE_APP_ENV", "test");
    expect(await withdrawCustomerPhotoPermission("salon-a")).toEqual({ allowPhoto: false });
    expect(mocks.call).not.toHaveBeenCalled();
    vi.stubEnv("VITE_APP_ENV", "production");
    mocks.call.mockResolvedValue({ allowPhoto: false });
    await withdrawCustomerPhotoPermission("salon-a");
    expect(mocks.call).toHaveBeenCalledOnce();
  });
  it("uses customer Auth and only supplies salon scope", async () => {
    mocks.call.mockResolvedValue({ allowPhoto: false });
    expect(await withdrawCustomerPhotoPermission("salon-a")).toEqual({ allowPhoto: false });
    expect(mocks.call).toHaveBeenCalledWith("withdrawWebCustomerPhotoConsent", {
      salonId: "salon-a",
    });
  });
  it("does not claim success for an unconfirmed server response", async () => {
    mocks.call.mockResolvedValue({ allowPhoto: true });
    await expect(withdrawCustomerPhotoPermission("salon-a")).rejects.toThrow();
  });
});
