type Bucket = { tokens: number; updatedAtMs: number };

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly options: { refillPerSecond: number; capacity: number }) {}

  tryAcquire(key: string, nowMs = Date.now()) {
    const current = this.buckets.get(key) ?? {
      tokens: this.options.capacity,
      updatedAtMs: nowMs,
    };
    const elapsedSeconds = Math.max(0, nowMs - current.updatedAtMs) / 1_000;
    current.tokens = Math.min(
      this.options.capacity,
      current.tokens + elapsedSeconds * this.options.refillPerSecond,
    );
    current.updatedAtMs = nowMs;
    if (current.tokens < 1) {
      this.buckets.set(key, current);
      return false;
    }
    current.tokens -= 1;
    this.buckets.set(key, current);
    return true;
  }
}

export class ConcurrencyGuard {
  private active = 0;
  constructor(private readonly limit: number) {}
  tryEnter() {
    if (this.active >= this.limit) return false;
    this.active += 1;
    return true;
  }
  leave() {
    this.active = Math.max(0, this.active - 1);
  }
}
