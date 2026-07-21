import { describe, it, expect } from "vitest";
import { resolveProductReference } from "../referenceResolver";

const products = [
  { id: "p1", name: "Hydrating Moisturizer" },
  { id: "p2", name: "Radiance Vitamin C Serum" },
  { id: "p3", name: "Brightening Night Cream" },
];

describe("resolveProductReference", () => {
  it("returns null for empty product list", () => {
    expect(resolveProductReference("tell me more", [])).toBeNull();
  });

  // ── Ordinal references ──

  it('resolves "first one" to the first product', () => {
    const result = resolveProductReference("the first one", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p1");
  });

  it('resolves "second" to the second product', () => {
    const result = resolveProductReference("the second", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p2");
  });

  it('resolves "third one" to the third product', () => {
    const result = resolveProductReference("third one", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p3");
  });

  it('resolves "last one" to the last product', () => {
    const result = resolveProductReference("the last one", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p3");
  });

  it('resolves "1" to the first product', () => {
    const result = resolveProductReference("#1", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p1");
  });

  it('resolves "2" to the second product', () => {
    const result = resolveProductReference("number 2", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p2");
  });

  // ── Name matching ──

  it('resolves "the serum" to the product with "Serum" in the name', () => {
    const result = resolveProductReference("tell me about the serum", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p2");
  });

  it('resolves "moisturizer" to the product with "Moisturizer" in the name', () => {
    const result = resolveProductReference("show me the moisturizer", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p1");
  });

  it("resolves partial word match: 'vitamin c'", () => {
    const result = resolveProductReference("is vitamin c good for me", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p2");
  });

  it("prefers longest match when multiple names overlap", () => {
    const result = resolveProductReference("night cream", products);
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("p3");
  });

  it("returns null for unrelated message", () => {
    const result = resolveProductReference("thanks!", products);
    expect(result).toBeNull();
  });
});
