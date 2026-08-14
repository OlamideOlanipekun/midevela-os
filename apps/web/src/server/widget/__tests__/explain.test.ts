/**
 * Tests for explain.ts (B8) — explainRecommendation and summariseConstraints
 */
import { describe, it, expect } from "vitest";
import { explainRecommendation, summariseConstraints } from "../explain";
import type { ParsedConstraints } from "../intentEngine";

describe("explainRecommendation (B8)", () => {
  const baseProduct = {
    id: "p1",
    name: "Nike Air Casual",
    brand: "Nike",
    priceRaw: 75000,
    currency: "NGN",
    price: "₦75,000",
    inStock: true,
    category: "Sneakers",
    attributes: { color: "black", style: "casual" },
  };

  it("mentions budget match when within maxPrice", () => {
    const constraints: ParsedConstraints = { maxPrice: 100000 };
    const result = explainRecommendation(baseProduct, constraints);
    expect(result).toContain("budget");
    expect(result).toContain("₦75,000");
  });

  it("mentions brand match when brand matches constraint", () => {
    const constraints: ParsedConstraints = { brand: "Nike" };
    const result = explainRecommendation(baseProduct, constraints);
    expect(result).toContain("Nike");
  });

  it("mentions color match from attributes", () => {
    const constraints: ParsedConstraints = { color: "black" };
    const result = explainRecommendation(baseProduct, constraints);
    expect(result).toContain("black");
  });

  it("mentions style match", () => {
    const constraints: ParsedConstraints = { style: "casual" };
    const result = explainRecommendation(baseProduct, constraints);
    expect(result).toContain("casual");
  });

  it("mentions availability for in-stock product", () => {
    const result = explainRecommendation(baseProduct, {});
    expect(result).toContain("available");
  });

  it("does NOT include budget reason when product exceeds maxPrice", () => {
    const constraints: ParsedConstraints = { maxPrice: 50000 };
    const result = explainRecommendation(baseProduct, constraints);
    expect(result).not.toContain("within your");
  });

  it("returns a fallback for products with no matching constraints", () => {
    const result = explainRecommendation(
      { ...baseProduct, inStock: false },
      {}
    );
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("summariseConstraints (B8)", () => {
  it("builds a readable constraint summary", () => {
    const constraints: ParsedConstraints = {
      category: "sneakers",
      color: "black",
      maxPrice: 100000,
      style: "casual",
    };
    const summary = summariseConstraints(constraints);
    expect(summary).toContain("sneakers");
    expect(summary).toContain("black");
    expect(summary).toContain("casual");
    expect(summary).toContain("100,000");
  });

  it("returns empty string for empty constraints", () => {
    expect(summariseConstraints({})).toBe("");
  });
});
