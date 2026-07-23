import { describe, expect, it, vi } from "vitest";
import { createBiometricUnlockSingleFlight, runBiometricUnlock } from "./biometricUnlock";

describe("mở khóa sinh trắc học", () => {
  it("mở khóa thành công", async () => {
    await expect(
      runBiometricUnlock({
        check: async () => ({ isAvailable: true, deviceIsSecure: true }),
        authenticate: async () => undefined,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("phân biệt người dùng hủy", async () => {
    await expect(
      runBiometricUnlock({
        check: async () => ({ isAvailable: true, deviceIsSecure: true }),
        authenticate: async () => {
          throw { code: "userCancel" };
        },
      }),
    ).resolves.toMatchObject({ ok: false, code: "BIOMETRIC_CANCELLED" });
  });

  it("báo thiết bị không hỗ trợ nhưng không ném lỗi", async () => {
    const authenticate = vi.fn();
    await expect(
      runBiometricUnlock({
        check: async () => ({ isAvailable: false, deviceIsSecure: false }),
        authenticate,
      }),
    ).resolves.toMatchObject({ ok: false, code: "BIOMETRIC_UNAVAILABLE" });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("hạ lỗi plugin thành thông báo an toàn", async () => {
    await expect(
      runBiometricUnlock({
        check: async () => ({ isAvailable: true, deviceIsSecure: true }),
        authenticate: async () => {
          throw new Error("native bridge secret detail");
        },
      }),
    ).resolves.toMatchObject({ ok: false, code: "BIOMETRIC_FAILED" });
  });

  it("cho phép thử lại sau thất bại", async () => {
    const authenticate = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(undefined);
    const unlock = () =>
      runBiometricUnlock({
        check: async () => ({ isAvailable: true, deviceIsSecure: true }),
        authenticate,
      });
    expect(await unlock()).toMatchObject({ ok: false });
    expect(await unlock()).toEqual({ ok: true });
  });

  it("không gọi plugin song song khi người dùng bấm nhiều lần", async () => {
    let resolve!: (value: { ok: true }) => void;
    const task = vi.fn(() => new Promise<{ ok: true }>((done) => (resolve = done)));
    const unlock = createBiometricUnlockSingleFlight(task);
    const first = unlock();
    const second = unlock();
    expect(task).toHaveBeenCalledOnce();
    resolve({ ok: true });
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
  });
});
