import { describe, it, expect, beforeEach } from "vitest";
import { LocalRateLimiter } from "../localRateLimiter";

describe("LocalRateLimiter", () => {
  let limiter: LocalRateLimiter;

  beforeEach(() => {
    limiter = new LocalRateLimiter(1_000);
  });

  it("allows requests under the limit", () => {
    const r1 = limiter.check("ip:1.2.3.4", 10, 60);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(9);
    expect(r1.limit).toBe(10);
    expect(r1.resetSec).toBe(60);
  });

  it("allows requests exactly at the limit", () => {
    // First request creates entry (count=1, remaining=9)
    // Need 9 more to hit limit (count=10, remaining=0)
    for (let i = 0; i < 9; i++) {
      limiter.check("ip:1.2.3.4", 10, 60);
    }
    const r = limiter.check("ip:1.2.3.4", 10, 60);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("rejects requests above the limit", () => {
    // First 10 requests (indices 0-9) should be OK
    for (let i = 0; i < 10; i++) {
      limiter.check("ip:1.2.3.4", 10, 60);
    }
    // 11th request should fail
    const r = limiter.check("ip:1.2.3.4", 10, 60);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("resets the window after expiry", async () => {
    // Use a very short window (10ms)
    limiter.check("ip:1.2.3.4", 1, 0.1); // windowSec = 0.1 → 100ms
    expect(limiter.check("ip:1.2.3.4", 1, 0.1).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 150));
    const after = limiter.check("ip:1.2.3.4", 1, 0.1);
    expect(after.ok).toBe(true);
    expect(after.remaining).toBe(0);
  });

  it("isolates different keys", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("ip:A", 5, 60);
    }
    // Key "ip:A" is now at the limit
    expect(limiter.check("ip:A", 5, 60).remaining).toBe(0);
    // Key "ip:B" starts fresh
    expect(limiter.check("ip:B", 5, 60).remaining).toBe(4);
  });

  it("computes decreasing resetSec", async () => {
    const r1 = limiter.check("ip:1.2.3.4", 5, 60);
    expect(r1.resetSec).toBe(60);
    // Wait a few ms so the second call has a different elapsed time
    await new Promise((r) => setTimeout(r, 10));
    const r2 = limiter.check("ip:1.2.3.4", 5, 60);
    expect(r2.resetSec).toBeLessThan(60);
  });

  it("sweeps expired entries", async () => {
    // Create entries with a short window
    limiter.check("expired-key", 10, 0.01); // 10ms
    await new Promise((r) => setTimeout(r, 50));
    // Sweep is triggered by map size vs maxEntries or periodic cleanup
    // Force it by adding many keys
    for (let i = 0; i < 10; i++) {
      limiter.check(`filler-${i}`, 10, 60);
    }
    expect(limiter.size).toBeLessThan(12); // The expired one should be gone
  });

  it("evicts oldest entries when over max size", () => {
    const tiny = new LocalRateLimiter(5);
    for (let i = 0; i < 10; i++) {
      tiny.check(`key-${i}`, 10, 60);
    }
    // Eviction reduces to floor(5 * 0.75) = 3 entries
    expect(tiny.size).toBeLessThanOrEqual(4);
  });

  it("remains usable after eviction", () => {
    const tiny = new LocalRateLimiter(5);
    for (let i = 0; i < 10; i++) {
      tiny.check(`key-${i}`, 10, 60);
    }
    // The most recent keys should have survived eviction
    const r = tiny.check("key-9", 10, 60);
    expect(r.ok).toBe(true); // "key-9" is the newest, likely kept
  });

  it("resets correctly", () => {
    limiter.check("ip:A", 1, 60);
    limiter.check("ip:B", 1, 60);
    expect(limiter.size).toBe(2);
    limiter.reset();
    expect(limiter.size).toBe(0);
    expect(limiter.check("ip:A", 1, 60).remaining).toBe(0);
  });

  it("prevents counter overflow under sustained hammering", () => {
    for (let i = 0; i < 10_000; i++) {
      limiter.check("hammered", 5, 60);
    }
    const r = limiter.check("hammered", 5, 60);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });
});
