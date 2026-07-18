import { describe, expect, it, vi } from "vitest";
import { ManagerBootstrapError, createSingleFlight, runManagerBootstrap } from "./managerBootstrap";

describe("Manager bootstrap", () => {
  it("khởi tạo thành công và vẫn yêu cầu ẩn splash", async () => {
    const cleanup = vi.fn();
    const hideSplash = vi.fn().mockResolvedValue(true);
    const result = await runManagerBootstrap({
      initialize: vi.fn().mockResolvedValue(cleanup),
      hideSplash,
      track: vi.fn(),
    });

    expect(result).toMatchObject({ ok: true });
    expect(hideSplash).toHaveBeenCalledOnce();
  });

  it.each([
    "MANAGER_FIREBASE_INIT_FAILED",
    "MANAGER_APP_CHECK_FAILED",
    "MANAGER_NATIVE_PLUGIN_FAILED",
  ] as const)("trả lỗi an toàn khi bootstrap lỗi %s", async (code) => {
    const track = vi.fn();
    const result = await runManagerBootstrap({
      initialize: vi.fn().mockRejectedValue(new ManagerBootstrapError(code, "secret detail")),
      hideSplash: vi.fn().mockResolvedValue(true),
      track,
    });

    expect(result).toMatchObject({ ok: false, code });
    expect(JSON.stringify(result)).not.toContain("secret detail");
    expect(track).toHaveBeenCalledWith(
      "manager_bootstrap_failed",
      expect.objectContaining({ error_code: code }),
    );
  });

  it("ghi sự kiện riêng khi App Check hoặc hide splash lỗi", async () => {
    const track = vi.fn();
    await runManagerBootstrap({
      initialize: vi.fn().mockRejectedValue(new ManagerBootstrapError("MANAGER_APP_CHECK_FAILED")),
      hideSplash: vi.fn().mockResolvedValue(false),
      track,
    });

    expect(track).toHaveBeenCalledWith("manager_app_check_failed", expect.any(Object));
    expect(track).toHaveBeenCalledWith("manager_splash_hide_failed", expect.any(Object));
  });

  it("không làm bootstrap văng lỗi khi hàm ẩn splash bất ngờ throw", async () => {
    const track = vi.fn();
    const result = await runManagerBootstrap({
      initialize: vi.fn().mockResolvedValue(vi.fn()),
      hideSplash: vi.fn().mockRejectedValue(new Error("native bridge failed")),
      track,
    });

    expect(result).toMatchObject({ ok: true });
    expect(track).toHaveBeenCalledWith("manager_splash_hide_failed", expect.any(Object));
  });

  it("cho phép người dùng thử lại sau lần đầu thất bại", async () => {
    const initialize = vi
      .fn()
      .mockRejectedValueOnce(new ManagerBootstrapError("MANAGER_NATIVE_PLUGIN_FAILED"))
      .mockResolvedValueOnce(vi.fn());
    const common = { hideSplash: vi.fn().mockResolvedValue(true), track: vi.fn() };

    expect(await runManagerBootstrap({ initialize, ...common })).toMatchObject({ ok: false });
    expect(await runManagerBootstrap({ initialize, ...common })).toMatchObject({ ok: true });
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it("không khởi tạo plugin trùng khi hai lời gọi đang chạy", async () => {
    let resolve!: (value: string) => void;
    const task = vi.fn(() => new Promise<string>((done) => (resolve = done)));
    const initialize = createSingleFlight(task);

    const first = initialize("first");
    const second = initialize("second");
    expect(task).toHaveBeenCalledOnce();
    resolve("ready");
    await expect(Promise.all([first, second])).resolves.toEqual(["ready", "ready"]);
  });

  it("hết thời gian chờ nhưng vẫn yêu cầu ẩn splash", async () => {
    const hideSplash = vi.fn().mockResolvedValue(true);
    const result = await runManagerBootstrap({
      initialize: () => new Promise(() => undefined),
      hideSplash,
      track: vi.fn(),
      timeoutMs: 5,
    });

    expect(result).toMatchObject({ ok: false, code: "MANAGER_BOOTSTRAP_TIMEOUT" });
    expect(hideSplash).toHaveBeenCalledOnce();
  });
});
