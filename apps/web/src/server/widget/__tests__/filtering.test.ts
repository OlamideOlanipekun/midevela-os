/**
 * Unit tests for filtering.ts (Milestone B2 & B3)
 * Tests passesHardConstraints and hard filtering logic
 */
import { describe, it, expect } from "vitest";
import { passesHardConstraints } from "../../catalog/filtering";
import type { ParsedConstraints } from "../intentEngine";

describe("passesHardConstraints (B3)", () => {
  it("passes when price is below maxPrice", () => {
    const constraints: ParsedConstraints = { maxPrice: 100000 };
    expect(passesHardConstraints(80000, "NGN", constraints)).toBe(true);
  });

  it("fails when price strictly exceeds maxPrice", () => {
    const constraints: ParsedConstraints = { maxPrice: 100000 };
    expect(passesHardConstraints(150000, "NGN", constraints)).toBe(false);
  });

  it("passes when price equals maxPrice", () => {
    const constraints: ParsedConstraints = { maxPrice: 100000 };
    expect(passesHardConstraints(100000, "NGN", constraints)).toBe(true);
  });

  it("fails when price is below minPrice", () => {
    const constraints: ParsedConstraints = { minPrice: 20000 };
    expect(passesHardConstraints(10000, "NGN", constraints)).toBe(false);
  });

  it("fails when currency does not match budget currency", () => {
    const constraints: ParsedConstraints = { maxPrice: 100000 };
    expect(passesHardConstraints(50000, "USD", constraints, "NGN")).toBe(false);
  });

  it("passes when currency matches budget currency", () => {
    const constraints: ParsedConstraints = { maxPrice: 100000 };
    expect(passesHardConstraints(50000, "NGN", constraints, "NGN")).toBe(true);
  });
});
