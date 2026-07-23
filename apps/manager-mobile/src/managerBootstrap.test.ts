import { describe, expect, it, vi } from "vitest";
import { ManagerBootstrapError, createSingleFlight, runManagerBootstrap } from "./managerBootstrap";

type Cleanup = () => void | Promise<void>;

function bootstrapAttempt(initialize: () => Promise<Cleanup>) {
  const start = createSingleFlight<void, Cleanup>(async () => initialize(), {
    cleanup: (cleanup) => cleanup(),
  });
  return start("test-user", undefined);
}

describe("Manager bootstrap", () => {
  it("khởi tạo thành công và vẫn yêu cầu ẩn splash", async () => {
    const cleanup = vi.fn();
    const hideSplash = vi.fn().mockResolvedValue(true);
    const result = await runManagerBootstrap({
      attempt: bootstrapAttempt(vi.fn().mockResolvedValue(cleanup)),
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
      attempt: bootstrapAttempt(
        vi.fn().mockRejectedValue(new ManagerBootstrapError(code, "secret detail")),
      ),
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
      attempt: bootstrapAttempt(
        vi.fn().mockRejectedValue(new ManagerBootstrapError("MANAGER_APP_CHECK_FAILED")),
      ),
      hideSplash: vi.fn().mockResolvedValue(false),
      track,
    });

    expect(track).toHaveBeenCalledWith("manager_app_check_failed", expect.any(Object));
    expect(track).toHaveBeenCalledWith("manager_splash_hide_failed", expect.any(Object));
  });

  it("không làm bootstrap văng lỗi khi hàm ẩn splash bất ngờ throw", async () => {
    const track = vi.fn();
    const result = await runManagerBootstrap({
      attempt: bootstrapAttempt(vi.fn().mockResolvedValue(vi.fn())),
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

    expect(
      await runManagerBootstrap({ attempt: bootstrapAttempt(initialize), ...common }),
    ).toMatchObject({ ok: false });
    expect(
      await runManagerBootstrap({ attempt: bootstrapAttempt(initialize), ...common }),
    ).toMatchObject({ ok: true });
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it("không khởi tạo plugin trùng khi hai lời gọi đang chạy", async () => {
    let resolve!: (value: string) => void;
    const task = vi.fn(() => new Promise<string>((done) => (resolve = done)));
    const initialize = createSingleFlight(task);

    const first = initialize("same-user", "first");
    const second = initialize("same-user", "second");
    await Promise.resolve();
    expect(task).toHaveBeenCalledOnce();
    resolve("ready");
    await expect(Promise.all([first.result, second.result])).resolves.toEqual(["ready", "ready"]);
  });

  it("hết thời gian chờ nhưng vẫn yêu cầu ẩn splash", async () => {
    const hideSplash = vi.fn().mockResolvedValue(true);
    const result = await runManagerBootstrap({
      attempt: bootstrapAttempt(() => new Promise(() => undefined)),
      hideSplash,
      track: vi.fn(),
      timeoutMs: 5,
    });

    expect(result).toMatchObject({ ok: false, code: "MANAGER_BOOTSTRAP_TIMEOUT" });
    expect(hideSplash).toHaveBeenCalledOnce();
  });

  it("timeout giải phóng attempt để retry và kết quả cũ không dọn attempt mới", async () => {
    vi.useFakeTimers();
    try {
      const pending = Array.from({ length: 2 }, () => deferred<Cleanup>());
      const oldCleanup = vi.fn();
      const currentCleanup = vi.fn();
      let activeConsumers = 0;
      const task = vi.fn((index: number) => pending[index].promise);
      const start = createSingleFlight(task, {
        cleanup: (cleanup) => cleanup(),
        onActivate: () => {
          activeConsumers += 1;
        },
        onDeactivate: () => {
          activeConsumers -= 1;
        },
      });
      const common = { hideSplash: vi.fn().mockResolvedValue(true), track: vi.fn(), timeoutMs: 10 };

      const firstAttempt = start("owner-1", 0);
      const firstRun = runManagerBootstrap({ attempt: firstAttempt, ...common });
      await vi.advanceTimersByTimeAsync(11);
      await expect(firstRun).resolves.toMatchObject({
        ok: false,
        code: "MANAGER_BOOTSTRAP_TIMEOUT",
      });
      expect(activeConsumers).toBe(0);

      const secondAttempt = start("owner-1", 1);
      expect(secondAttempt.attemptId).not.toBe(firstAttempt.attemptId);
      await Promise.resolve();
      expect(task).toHaveBeenCalledTimes(2);
      const secondRun = runManagerBootstrap({ attempt: secondAttempt, ...common });
      pending[1].resolve(currentCleanup);
      const secondResult = await secondRun;
      expect(secondResult).toMatchObject({ ok: true });
      expect(activeConsumers).toBe(1);

      pending[0].resolve(oldCleanup);
      await flushPromises();
      expect(oldCleanup).toHaveBeenCalledOnce();
      expect(currentCleanup).not.toHaveBeenCalled();
      expect(activeConsumers).toBe(1);

      if (secondResult.ok) await secondResult.cleanup();
      expect(currentCleanup).toHaveBeenCalledOnce();
      expect(activeConsumers).toBe(0);
      await firstAttempt.invalidate();
      expect(oldCleanup).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hai lần timeout vẫn cho attempt thứ ba khởi tạo thành công", async () => {
    vi.useFakeTimers();
    try {
      const pending = Array.from({ length: 3 }, () => deferred<Cleanup>());
      const start = createSingleFlight((index: number) => pending[index].promise, {
        cleanup: (cleanup) => cleanup(),
      });
      const common = { hideSplash: vi.fn().mockResolvedValue(true), track: vi.fn(), timeoutMs: 10 };

      for (const index of [0, 1]) {
        const run = runManagerBootstrap({ attempt: start("owner-1", index), ...common });
        await vi.advanceTimersByTimeAsync(11);
        await expect(run).resolves.toMatchObject({ code: "MANAGER_BOOTSTRAP_TIMEOUT" });
      }

      const thirdAttempt = start("owner-1", 2);
      const thirdRun = runManagerBootstrap({ attempt: thirdAttempt, ...common });
      pending[2].resolve(vi.fn());
      await expect(thirdRun).resolves.toMatchObject({ ok: true });
      expect(thirdAttempt.attemptId).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
