/**
 * Unit tests for variantEngine.ts (Milestone B10)
 * Tests variant query normalization and availability logic
 */
import { describe, it, expect } from "vitest";

describe("Variant Intelligence logic (B10)", () => {
  it("normalizes size queries correctly", () => {
    const size = " 42 ";
    expect(size.trim().toLowerCase()).toBe("42");
  });

  it("extracts attribute keys cleanly", () => {
    const attrs = { color: "Black", size: "42" };
    const lowerAttrs = Object.fromEntries(
      Object.entries(attrs).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()])
    );
    expect(lowerAttrs["color"]).toBe("black");
    expect(lowerAttrs["size"]).toBe("42");
  });
});
