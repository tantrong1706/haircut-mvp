import { describe, expect, it, vi } from "vitest";
import {
  createPushInitializationSingleFlight,
  runOptionalPushInitialization,
} from "./optionalPush";

describe("khoi tao thong bao khong chan Manager", () => {
  it("tra trang thai san sang va giu cleanup khi Push hoat dong", async () => {
    const cleanup = vi.fn();
    const start = createPushInitializationSingleFlight(async () => ({ status: "ready", cleanup }));
    const result = await runOptionalPushInitialization({
      attempt: start("owner-1"),
      onWarning: vi.fn(),
    });

    expect(result.status).toBe("ready");
    await result.cleanup();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("giu trang thai tu choi ma khong bien thanh loi bootstrap", async () => {
    const warning = vi.fn();
    const start = createPushInitializationSingleFlight(async () => ({
      status: "denied",
      cleanup: async () => undefined,
    }));
    const result = await runOptionalPushInitialization({
      attempt: start("owner-1"),
      onWarning: warning,
    });

    expect(result.status).toBe("denied");
    expect(warning).not.toHaveBeenCalled();
  });

  it("ha loi plugin thanh canh bao khong chan", async () => {
    const warning = vi.fn();
    const start = createPushInitializationSingleFlight(async () => {
      throw new Error("MANAGER_PUSH_PLUGIN_FAILED");
    });
    const result = await runOptionalPushInitialization({
      attempt: start("owner-1"),
      onWarning: warning,
    });

    expect(result.status).toBe("unavailable");
    expect(warning).toHaveBeenCalledWith("MANAGER_PUSH_PLUGIN_FAILED");
  });

  it("ha timeout thanh canh bao va don initialization den muon", async () => {
    vi.useFakeTimers();
    try {
      const initialization = deferred<{ status: "ready"; cleanup: () => void }>();
      const cleanup = vi.fn();
      const warning = vi.fn();
      const start = createPushInitializationSingleFlight(async () => initialization.promise);
      const pending = runOptionalPushInitialization({
        attempt: start("owner-1"),
        timeoutMs: 10,
        onWarning: warning,
      });

      await vi.advanceTimersByTimeAsync(11);
      await expect(pending).resolves.toMatchObject({ status: "unavailable" });
      expect(warning).toHaveBeenCalledWith("MANAGER_PUSH_TIMEOUT");

      initialization.resolve({ status: "ready", cleanup });
      await flushPromises();
      expect(cleanup).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("khong dang ky listener trung cho cung mot tai khoan", async () => {
    const initialization = deferred<{ status: "ready"; cleanup: () => void }>();
    const initialize = vi.fn(() => initialization.promise);
    const start = createPushInitializationSingleFlight(initialize);

    const first = start("owner-1");
    const second = start("owner-1");
    await Promise.resolve();
    expect(initialize).toHaveBeenCalledOnce();
    expect(second.attemptId).toBe(first.attemptId);

    initialization.resolve({ status: "ready", cleanup: vi.fn() });
    await expect(Promise.all([first.result, second.result])).resolves.toHaveLength(2);
  });

  it("tach attempt theo tai khoan va cleanup listener cu dung mot lan", async () => {
    const accountA = deferred<{ status: "ready"; cleanup: () => void }>();
    const accountB = deferred<{ status: "ready"; cleanup: () => void }>();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();
    const initialize = vi.fn((userKey: string) =>
      userKey === "owner-a" ? accountA.promise : accountB.promise,
    );
    const start = createPushInitializationSingleFlight(initialize);

    const attemptA = start("owner-a");
    const runA = runOptionalPushInitialization({ attempt: attemptA, onWarning: vi.fn() });
    const attemptB = start("owner-b");
    const runB = runOptionalPushInitialization({ attempt: attemptB, onWarning: vi.fn() });

    await Promise.resolve();
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(attemptB.attemptId).not.toBe(attemptA.attemptId);
    await expect(runA).resolves.toMatchObject({ status: "unavailable" });

    accountB.resolve({ status: "ready", cleanup: cleanupB });
    const resultB = await runB;
    expect(resultB.status).toBe("ready");

    accountA.resolve({ status: "ready", cleanup: cleanupA });
    await flushPromises();
    expect(cleanupA).toHaveBeenCalledOnce();
    expect(cleanupB).not.toHaveBeenCalled();

    await attemptA.invalidate();
    expect(cleanupA).toHaveBeenCalledOnce();
    await resultB.cleanup();
    expect(cleanupB).toHaveBeenCalledOnce();
  });

  it("timeout cho phep retry tao attempt moi va bo qua ket qua muon", async () => {
    vi.useFakeTimers();
    try {
      const attempts = [
        deferred<{ status: "ready"; cleanup: () => void }>(),
        deferred<{ status: "ready"; cleanup: () => void }>(),
      ];
      const cleanupOld = vi.fn();
      const cleanupCurrent = vi.fn();
      const initialize = vi
        .fn()
        .mockImplementationOnce(() => attempts[0].promise)
        .mockImplementationOnce(() => attempts[1].promise);
      const start = createPushInitializationSingleFlight(initialize);
      const warning = vi.fn();

      const first = runOptionalPushInitialization({
        attempt: start("owner-1"),
        timeoutMs: 10,
        onWarning: warning,
      });
      await vi.advanceTimersByTimeAsync(11);
      await expect(first).resolves.toMatchObject({ status: "unavailable" });

      const secondAttempt = start("owner-1");
      const second = runOptionalPushInitialization({
        attempt: secondAttempt,
        timeoutMs: 10,
        onWarning: warning,
      });
      await Promise.resolve();
      expect(initialize).toHaveBeenCalledTimes(2);
      attempts[1].resolve({ status: "ready", cleanup: cleanupCurrent });
      const secondResult = await second;
      expect(secondResult.status).toBe("ready");

      attempts[0].resolve({ status: "ready", cleanup: cleanupOld });
      await flushPromises();
      expect(cleanupOld).toHaveBeenCalledOnce();
      expect(cleanupCurrent).not.toHaveBeenCalled();
      await secondResult.cleanup();
      expect(cleanupCurrent).toHaveBeenCalledOnce();
      expect(warning).toHaveBeenCalledTimes(1);
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
