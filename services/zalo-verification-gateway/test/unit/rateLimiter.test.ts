import { describe, expect, it } from "vitest";
import { ConcurrencyGuard, TokenBucketRateLimiter } from "../../src/security/rateLimiter.js";

describe("TokenBucketRateLimiter", () => {
  it("allows burst 50 and rejects the next request", () => {
    const limiter = new TokenBucketRateLimiter({ refillPerSecond: 20, capacity: 50 });
    for (let index = 0; index < 50; index += 1)
      expect(limiter.tryAcquire("key-a", 1_000)).toBe(true);
    expect(limiter.tryAcquire("key-a", 1_000)).toBe(false);
  });
  it("refills 20 tokens per second independently by key", () => {
    const limiter = new TokenBucketRateLimiter({ refillPerSecond: 20, capacity: 50 });
    for (let index = 0; index < 50; index += 1) limiter.tryAcquire("key-a", 1_000);
    expect(limiter.tryAcquire("key-b", 1_000)).toBe(true);
    for (let index = 0; index < 20; index += 1)
      expect(limiter.tryAcquire("key-a", 2_000)).toBe(true);
    expect(limiter.tryAcquire("key-a", 2_000)).toBe(false);
  });
});

describe("ConcurrencyGuard", () => {
  it("rejects work above the global limit and releases capacity", () => {
    const guard = new ConcurrencyGuard(2);
    expect(guard.tryEnter()).toBe(true);
    expect(guard.tryEnter()).toBe(true);
    expect(guard.tryEnter()).toBe(false);
    guard.leave();
    expect(guard.tryEnter()).toBe(true);
  });
});
