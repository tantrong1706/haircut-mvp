import { describe, expect, it, vi } from "vitest";
import { createNativeInitializationController, extractRewardCode } from "./nativeRuntime";

describe("mã quà từ camera", () => {
  it("nhận mã quà dạng chữ và URL", () => {
    expect(extractRewardCode("haircut-reward:v1:HC-20260716-ABCD12")).toBe(
      "HC-20260716-ABCD12",
    );
  });

  it("từ chối nội dung camera không hợp lệ", () => {
    expect(extractRewardCode("abc")).toBe("");
    expect(extractRewardCode("HC-20260716-ABCD12")).toBe("");
    expect(extractRewardCode("https://haircut.example/reward?code=HC-ABCDEF12")).toBe("");
    expect(extractRewardCode("https://example.com/no-code")).toBe("");
  });
});

describe("native initialization ownership", () => {
  it("can bang consumer khi attempt cu treo, retry va cleanup", async () => {
    const attempts = [deferred<() => void>(), deferred<() => void>()];
    const cleanupOld = vi.fn();
    const cleanupCurrent = vi.fn();
    const controller = createNativeInitializationController(
      async (index: number) => attempts[index].promise,
    );

    const first = controller.start("owner-1", 0);
    const firstResult = first.result.catch((error) => error);
    expect(controller.getConsumerCount()).toBe(1);

    await first.invalidate();
    expect(controller.getConsumerCount()).toBe(0);

    const second = controller.start("owner-1", 1);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(controller.getConsumerCount()).toBe(1);

    attempts[1].resolve(cleanupCurrent);
    await second.result;
    attempts[0].resolve(cleanupOld);
    await firstResult;
    await flushPromises();

    expect(cleanupOld).toHaveBeenCalledOnce();
    expect(cleanupCurrent).not.toHaveBeenCalled();
    expect(controller.getConsumerCount()).toBe(1);

    await second.invalidate();
    await second.invalidate();
    expect(cleanupCurrent).toHaveBeenCalledOnce();
    expect(controller.getConsumerCount()).toBe(0);
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
