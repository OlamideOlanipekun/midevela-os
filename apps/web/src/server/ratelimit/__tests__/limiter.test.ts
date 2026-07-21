import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit, rateLimitEnabled, __resetForTest } from "../limiter";

beforeEach(() => {
  vi.restoreAllMocks();
  __resetForTest();
  vi.unstubAllEnvs();
});

describe("rateLimitEnabled", () => {
  it("returns false when Redis env vars are unset", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(rateLimitEnabled()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok_abc");
    expect(rateLimitEnabled()).toBe(true);
  });
});

describe("rateLimit — no Redis configured", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  it("falls through to local limiter when Redis is not configured", async () => {
    const r = await rateLimit("test-key", 5, 60);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
    expect(r.limit).toBe(5);
  });

  it("local limiter enforces limits when no Redis", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit("test-key", 5, 60);
    }
    const r = await rateLimit("test-key", 5, 60);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("isolates different keys when no Redis", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit("key-A", 5, 60);
    }
    const rA = await rateLimit("key-A", 5, 60);
    expect(rA.ok).toBe(false);
    const rB = await rateLimit("key-B", 5, 60);
    expect(rB.ok).toBe(true);
  });
});

describe("rateLimit — Redis configured and available", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok_abc");
  });

  it("uses Redis and returns normal result on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ result: 1 }])),
    );
    const r = await rateLimit("wl:ip:1.2.3.4", 10, 60);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(9);
    expect(r.limit).toBe(10);
    expect(r.resetSec).toBe(60);
  });

  it("enforces limits via Redis", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ result: 11 }])),
    );
    const r = await rateLimit("wl:ip:1.2.3.4", 10, 60);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("falls back to local limiter when Redis returns non-200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Server Error", { status: 500 }),
    );
    const r1 = await rateLimit("wl:ip:1.2.3.4", 5, 60);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(4);
    // Hit the local limit (5 req in window)
    for (let i = 0; i < 4; i++) {
      await rateLimit("wl:ip:1.2.3.4", 5, 60);
    }
    const r6 = await rateLimit("wl:ip:1.2.3.4", 5, 60);
    expect(r6.ok).toBe(false);
    expect(r6.remaining).toBe(0);
  });

  it("falls back to local limiter when Redis fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network timeout"));
    const r = await rateLimit("wl:ip:1.2.3.4", 5, 60);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("falls back to local limiter when Redis response is malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ error: "NOT_AUTHED" }])),
    );
    const r = await rateLimit("wl:ip:1.2.3.4", 5, 60);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("recovers to Redis-backed limiting when Redis comes back", async () => {
    // Phase 1: Redis is down — uses local fallback
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Down"));
    await rateLimit("wl:ip:1.2.3.4", 10, 60);
    // Phase 2: Redis recovers — should use Redis, not local
    __resetForTest(); // reset fallback-reported flag
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ result: 1 }])),
    );
    const r = await rateLimit("wl:ip:1.2.3.4", 10, 60);
    expect(r.ok).toBe(true);
    // Redis returns count=1 → remaining=9 (NOT affected by local limiter state)
    expect(r.remaining).toBe(9);
  });
});

describe("rateLimit — endpoint cost protection", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok_abc");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Redis down"));
  });

  it("message endpoint IP limit (60/min) is enforced during Redis failure", async () => {
    for (let i = 0; i < 60; i++) {
      const r = await rateLimit("wl:ip:1.2.3.4", 60, 60);
      if (!r.ok) break;
    }
    const r = await rateLimit("wl:ip:1.2.3.4", 60, 60);
    expect(r.ok).toBe(false);
  });

  it("message endpoint key limit (30/min) is enforced during Redis failure", async () => {
    for (let i = 0; i < 30; i++) {
      const r = await rateLimit("wl:key:widget-key-abc", 30, 60);
      if (!r.ok) break;
    }
    const r = await rateLimit("wl:key:widget-key-abc", 30, 60);
    expect(r.ok).toBe(false);
  });

  it("compare endpoint limit (15/min) is enforced during Redis failure", async () => {
    for (let i = 0; i < 15; i++) {
      const r = await rateLimit("wcmp:ip:1.2.3.4", 15, 60);
      if (!r.ok) break;
    }
    const r = await rateLimit("wcmp:ip:1.2.3.4", 15, 60);
    expect(r.ok).toBe(false);
  });

  it("recommend endpoint limit (30/min) is enforced during Redis failure", async () => {
    for (let i = 0; i < 30; i++) {
      const r = await rateLimit("wr:ip:1.2.3.4", 30, 60);
      if (!r.ok) break;
    }
    const r = await rateLimit("wr:ip:1.2.3.4", 30, 60);
    expect(r.ok).toBe(false);
  });

  it("global monthly cap is enforced during Redis failure", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit("usage:global:202607", 3, 86400);
      if (!r.ok) break;
    }
    const r = await rateLimit("usage:global:202607", 3, 86400);
    expect(r.ok).toBe(false);
  });

  it("multiple IPs remain isolated during Redis failure", async () => {
    for (let i = 0; i < 60; i++) {
      const r = await rateLimit("wl:ip:10.0.0.1", 60, 60);
      if (!r.ok) break;
    }
    const r = await rateLimit("wl:ip:10.0.0.2", 60, 60);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(59);
  });

  it("Redis failure never results in unlimited requests for expensive endpoints", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await rateLimit("wcmp:ip:1.2.3.4", 15, 60);
      // Never return remaining == limit after the first call (fresh window).
      // The local limiter decrements correctly.
      if (r.remaining === 15 && i > 0) {
        expect.fail(`Unlimited at call ${i}: remaining = 15`);
      }
    }
  });
});
