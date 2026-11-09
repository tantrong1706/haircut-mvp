import { beforeEach, expect, it, vi } from "vitest";
import { updateSalonProfile } from "./operations";

const mocks = vi.hoisted(() => ({ call: vi.fn(), fallback: vi.fn() }));
vi.mock("./firebase", () => ({ callFunction: mocks.call }));
vi.mock("./functionWrites", () => ({ callWriteFunctionOrFallback: mocks.fallback }));

const base = { salonId: "salon-fixture", name: "Salon mẫu", pointPerVisit: 1 };
beforeEach(() => vi.resetAllMocks());

it("requires confirmation of visibility changes, including false", async () => {
  mocks.call.mockResolvedValueOnce({ showHotline: false }).mockResolvedValueOnce(base);
  await expect(updateSalonProfile({ ...base, showHotline: false })).resolves.toMatchObject({
    showHotline: false,
  });
  expect(mocks.call).toHaveBeenCalledWith(
    "updateSalonProfile",
    expect.objectContaining({ showHotline: false }),
  );
  await expect(updateSalonProfile({ ...base, showLogo: false })).rejects.toThrow("chưa xác nhận");
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it("uses the owner callable for public changes and sends explicit clears", async () => {
  mocks.call.mockResolvedValue({ hotline: "", openingHours: "09:00–20:00" });
  await expect(
    updateSalonProfile({ ...base, hotline: " ", openingHours: " 09:00–20:00 " }),
  ).resolves.toMatchObject({ hotline: "", openingHours: "09:00–20:00" });
  expect(mocks.call).toHaveBeenCalledWith("updateSalonProfile", {
    ...base,
    address: "",
    phone: "",
    hotline: "",
    openingHours: "09:00–20:00",
  });
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it("does not report success if an old server ignores a public edit", async () => {
  mocks.call.mockResolvedValue(base);
  await expect(updateSalonProfile({ ...base, hotline: "028 0000 0000" })).rejects.toThrow(
    "chưa xác nhận lưu",
  );
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it("retains the existing write path for clients without public edits", async () => {
  mocks.fallback.mockResolvedValue(base);
  await expect(updateSalonProfile(base)).resolves.toEqual(base);
  expect(mocks.fallback).toHaveBeenCalledWith(
    "updateSalonProfile",
    {
      ...base,
      address: "",
      phone: "",
    },
    expect.any(Function),
  );
  expect(mocks.call).not.toHaveBeenCalled();
});
