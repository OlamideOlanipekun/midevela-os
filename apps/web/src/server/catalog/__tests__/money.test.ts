import { describe, it, expect } from "vitest";
import { formatMoney, normalizeCurrencyCode } from "../money";

describe("formatMoney", () => {
  it("formats NGN with naira symbol", () => {
    const result = formatMoney(150000, "NGN");
    expect(result).toContain("₦");
    expect(result).toContain("150,000");
  });

  it("formats USD with dollar symbol", () => {
    const result = formatMoney(499.99, "USD");
    expect(result).toContain("$");
    expect(result).toContain("499");
  });

  it("formats GBP with pound symbol", () => {
    const result = formatMoney(1000, "GBP");
    expect(result).toContain("£");
  });

  it("formats EUR with euro symbol", () => {
    const result = formatMoney(2000, "EUR");
    expect(result).toContain("€");
  });

  it("handles zero amount", () => {
    const result = formatMoney(0, "NGN");
    expect(result).toContain("₦0");
  });

  it("handles decimal amount", () => {
    const result = formatMoney(1234.56, "USD");
    expect(result).toContain("$");
    expect(result).toContain("1,234");
  });
});

describe("normalizeCurrencyCode", () => {
  it("returns NGN for naira symbol", () => {
    expect(normalizeCurrencyCode("₦")).toBe("NGN");
  });

  it("returns USD for dollar symbol", () => {
    expect(normalizeCurrencyCode("$")).toBe("USD");
  });

  it("returns uppercase ISO code", () => {
    expect(normalizeCurrencyCode("ngn")).toBe("NGN");
    expect(normalizeCurrencyCode("Usd")).toBe("USD");
  });

  it("returns null for unrecognized values", () => {
    expect(normalizeCurrencyCode("XYZ")).toBeNull();
    expect(normalizeCurrencyCode("")).toBeNull();
    expect(normalizeCurrencyCode(" ")).toBeNull();
    expect(normalizeCurrencyCode(null)).toBeNull();
    expect(normalizeCurrencyCode(undefined)).toBeNull();
    expect(normalizeCurrencyCode(123)).toBeNull();
  });
});
