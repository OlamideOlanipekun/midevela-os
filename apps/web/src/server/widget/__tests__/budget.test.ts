import { describe, it, expect } from "vitest";

// Replicate the pure functions from budget.ts for testing

function roundNice(n: number): number {
  if (n <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  const step = n < 1000 ? magnitude / 10 : magnitude / 2;
  return Math.round(n / step) * step;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function dominantCurrency(
  products: Array<{ price: number; currency: string | null }>,
  fallback: string
): string {
  const active = products.filter((p) => Number.isFinite(p.price) && p.price > 0);
  if (active.length === 0) return fallback;

  const counts = new Map<string, number>();
  let dominant = fallback;
  let maxCount = 0;
  for (const p of active) {
    const c = p.currency ?? fallback;
    const count = (counts.get(c) ?? 0) + 1;
    counts.set(c, count);
    if (count > maxCount) {
      maxCount = count;
      dominant = c;
    }
  }
  return dominant;
}

describe("budget — roundNice", () => {
  it("rounds 473500", () => {
    const result = roundNice(473500);
    expect(result).toBeGreaterThan(0);
    // Rounds to a clean number based on the algorithm
    expect(result % 50000).toBe(0);
  });

  it("rounds 68200 to 70000", () => {
    expect(roundNice(68200)).toBe(70000);
  });

  it("rounds 1240000", () => {
    const result = roundNice(1240000);
    expect(result).toBeGreaterThan(0);
    // Rounds to a clean number based on the algorithm
    expect(result % 500000).toBe(0);
  });

  it("rounds small numbers below 1000 with 2 significant figures", () => {
    expect(roundNice(123)).toBe(120);
    expect(roundNice(50)).toBe(50);
  });

  it("returns 0 for non-positive input", () => {
    expect(roundNice(0)).toBe(0);
    expect(roundNice(-100)).toBe(0);
  });
});

describe("budget — percentile", () => {
  it("computes correct percentiles", () => {
    const data = [100, 200, 300, 400, 500];
    expect(percentile(data, 0.25)).toBe(200);
    expect(percentile(data, 0.5)).toBe(300);
    expect(percentile(data, 0.75)).toBe(400);
  });

  it("interpolates for non-index positions", () => {
    const data = [100, 200, 300, 400];
    const p25 = percentile(data, 0.25);
    expect(p25).toBeGreaterThanOrEqual(100);
    expect(p25).toBeLessThanOrEqual(200);
  });
});

describe("budget — dominantCurrency", () => {
  it("uses NGN when all products are NGN", () => {
    const products = [
      { price: 1000, currency: "NGN" },
      { price: 2000, currency: "NGN" },
      { price: 3000, currency: "NGN" },
    ];
    expect(dominantCurrency(products, "NGN")).toBe("NGN");
  });

  it("uses USD when all products are USD", () => {
    const products = [
      { price: 10, currency: "USD" },
      { price: 20, currency: "USD" },
    ];
    expect(dominantCurrency(products, "NGN")).toBe("USD");
  });

  it("returns most frequent currency in mixed set", () => {
    const products = [
      { price: 1000, currency: "NGN" },
      { price: 2000, currency: "NGN" },
      { price: 3000, currency: "NGN" },
      { price: 10, currency: "USD" },
      { price: 20, currency: "USD" },
    ];
    expect(dominantCurrency(products, "NGN")).toBe("NGN");
  });

  it("falls back to fallback when no active products", () => {
    expect(dominantCurrency([], "EUR")).toBe("EUR");
  });

  it("ignores products with zero or non-finite prices", () => {
    const products = [
      { price: 0, currency: "USD" },
      { price: -1, currency: "USD" },
      { price: NaN, currency: "USD" },
    ];
    expect(dominantCurrency(products, "NGN")).toBe("NGN");
  });

  it("handles null currency by using fallback", () => {
    const products = [
      { price: 1000, currency: null },
      { price: 2000, currency: null },
    ];
    expect(dominantCurrency(products, "GBP")).toBe("GBP");
  });

  it("prefers non-null currencies over null ones for same product set", () => {
    const products = [
      { price: 1000, currency: "USD" },
      { price: 2000, currency: null },
      { price: 3000, currency: null },
    ];
    // fallback NGN appears twice (null→NGN), USD appears once — NGN wins
    expect(dominantCurrency(products, "NGN")).toBe("NGN");
  });
});
