/**
 * Tests for intentEngine.ts (B1) — local constraint extraction
 * and fast pattern matching.
 * Does not call the LLM — tests only the deterministic parts.
 */
import { describe, it, expect } from "vitest";
import { fastExtractConstraints } from "../intentEngine";

describe("fastExtractConstraints (B1/B2)", () => {
  it("extracts maxPrice from 'under ₦100k'", () => {
    const c = fastExtractConstraints("I need black sneakers under ₦100k");
    expect(c.maxPrice).toBe(100000);
  });

  it("extracts maxPrice from '80k' form", () => {
    const c = fastExtractConstraints("show me options below 80k");
    expect(c.maxPrice).toBe(80000);
  });

  it("extracts maxPrice from plain number", () => {
    const c = fastExtractConstraints("maximum 50000");
    expect(c.maxPrice).toBe(50000);
  });

  it("extracts minPrice from 'above 20k'", () => {
    const c = fastExtractConstraints("something above 20k");
    expect(c.minPrice).toBe(20000);
  });

  it("extracts color", () => {
    const c = fastExtractConstraints("I want a black casual sneaker");
    expect(c.color).toBe("black");
  });

  it("extracts style", () => {
    const c = fastExtractConstraints("something casual for everyday");
    expect(c.style).toBe("casual");
  });

  it("extracts useCase", () => {
    const c = fastExtractConstraints("I need something for office use");
    expect(c.useCase).toBe("office");
  });

  it("extracts both color and price together", () => {
    const c = fastExtractConstraints("black sneaker under ₦80k");
    expect(c.color).toBe("black");
    expect(c.maxPrice).toBe(80000);
  });

  it("returns empty object for generic chat", () => {
    const c = fastExtractConstraints("hello, how are you?");
    expect(c.color).toBeUndefined();
    expect(c.maxPrice).toBeUndefined();
    expect(c.style).toBeUndefined();
  });
});
