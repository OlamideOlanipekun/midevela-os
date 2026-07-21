import { describe, it, expect } from "vitest";

interface MockProduct {
  id: string;
  orgId: string;
  categoryId: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  price: { toString: () => string };
  currency: string;
  images: unknown;
  attributes: Record<string, unknown>;
  inventoryStatus: string;
  source: string;
  sourceUrl: string | null;
  aiDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function attributesFromRealData(products: MockProduct[]): Array<{ label: string; values: string[] }> {
  const keys = new Set<string>();
  for (const p of products) {
    const attrs = p.attributes;
    if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
      for (const k of Object.keys(attrs)) keys.add(k);
    }
  }
  const rows: Array<{ label: string; values: string[] }> = [];
  for (const key of keys) {
    const values = products.map((p) => {
      const attrs = p.attributes ?? {};
      const v = attrs[key];
      return v === undefined || v === null || v === "" ? "—" : String(v);
    });
    if (values.some((v) => v !== "—")) rows.push({ label: key, values });
  }
  return rows;
}

function databaseRows(ordered: MockProduct[]): Array<{ label: string; values: string[] }> {
  const rows: Array<{ label: string; values: string[] }> = [];

  rows.push({
    label: "Price",
    values: ordered.map((p) => `${p.currency} ${Number(p.price)}`),
  });

  rows.push({
    label: "Availability",
    values: ordered.map((p) => p.inventoryStatus.replace("_", " ").toLowerCase()),
  });

  const brands = ordered.map((p) => p.brand ?? "—");
  if (brands.some((b) => b !== "—")) {
    rows.push({ label: "Brand", values: brands });
  }

  rows.push(...attributesFromRealData(ordered));

  return rows;
}

function makeProduct(overrides: Partial<MockProduct> = {}): MockProduct {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    orgId: "org-1",
    categoryId: "cat-1",
    name: "Test Product",
    brand: "TestBrand",
    description: "A test product",
    price: { toString: () => "1000" },
    currency: "NGN",
    images: [],
    attributes: {},
    inventoryStatus: "IN_STOCK",
    source: "MANUAL",
    sourceUrl: null,
    aiDescription: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("compare — attributesFromRealData", () => {
  it("extracts attribute keys present on either product", () => {
    const a = makeProduct({ attributes: { color: "red", size: "M" } });
    const b = makeProduct({ attributes: { color: "blue", weight: "1kg" } });
    const rows = attributesFromRealData([a, b]);
    expect(rows.find((r) => r.label === "color")).toBeDefined();
    expect(rows.find((r) => r.label === "size")).toBeDefined();
    expect(rows.find((r) => r.label === "weight")).toBeDefined();
  });

  it("omits attributes where both products lack a value", () => {
    const a = makeProduct({ attributes: { color: "red" } });
    const b = makeProduct({ attributes: { color: "" } });
    const rows = attributesFromRealData([a, b]);
    expect(rows.find((r) => r.label === "color")).toBeDefined();
  });

  it("returns empty when neither product has attributes", () => {
    const a = makeProduct({ attributes: {} });
    const b = makeProduct({ attributes: {} });
    expect(attributesFromRealData([a, b])).toHaveLength(0);
  });

  it("handles null attributes", () => {
    const a = makeProduct({ attributes: null as unknown as Record<string, unknown> });
    const b = makeProduct({ attributes: null as unknown as Record<string, unknown> });
    expect(attributesFromRealData([a, b])).toHaveLength(0);
  });
});

describe("compare — databaseRows", () => {
  it("always includes price and availability", () => {
    const a = makeProduct();
    const b = makeProduct({ id: "id-2" });
    const rows = databaseRows([a, b]);
    expect(rows.some((r) => r.label === "Price")).toBe(true);
    expect(rows.some((r) => r.label === "Availability")).toBe(true);
  });

  it("includes brand row when at least one product has a brand", () => {
    const a = makeProduct({ brand: "Apple" });
    const b = makeProduct({ brand: null });
    const rows = databaseRows([a, b]);
    expect(rows.some((r) => r.label === "Brand")).toBe(true);
  });

  it("omits brand row when neither product has a brand", () => {
    const a = makeProduct({ brand: null });
    const b = makeProduct({ brand: null });
    const rows = databaseRows([a, b]);
    expect(rows.some((r) => r.label === "Brand")).toBe(false);
  });

  it("uses product currency for price display", () => {
    const a = makeProduct({ price: { toString: () => "500" } as unknown as number, currency: "USD" });
    const b = makeProduct({ id: "id-2", price: { toString: () => "300" } as unknown as number, currency: "USD" });
    const rows = databaseRows([a, b]);
    const priceRow = rows.find((r) => r.label === "Price")!;
    expect(priceRow.values[0]).toContain("USD");
    expect(priceRow.values[1]).toContain("USD");
  });

  it("includes structured attributes when present", () => {
    const a = makeProduct({ attributes: { screen: '15"', ram: "16GB" } });
    const b = makeProduct({ id: "id-2", attributes: { screen: '14"', ram: "8GB" } });
    const rows = databaseRows([a, b]);
    expect(rows.some((r) => r.label === "screen")).toBe(true);
    expect(rows.some((r) => r.label === "ram")).toBe(true);
  });

  it("does NOT generate rows from descriptions (no LLM fabrication)", () => {
    const a = makeProduct({ brand: null, attributes: {}, description: "15 inch laptop with 16GB RAM" });
    const b = makeProduct({ id: "id-2", brand: null, attributes: {}, description: "14 inch laptop with 8GB RAM" });
    const rows = databaseRows([a, b]);
    // Only price + availability since no brand and no attributes
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.label === "Price" || r.label === "Availability")).toBe(true);
  });
});
