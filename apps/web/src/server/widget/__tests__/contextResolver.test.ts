import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolvePageContext, buildContextHint } from "../contextResolver";

vi.mock("@/lib/prisma", () => {
  return {
    default: {
      websitePage: {
        findFirst: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
      },
      category: {
        findFirst: vi.fn(),
      },
    },
  };
});

import prisma from "@/lib/prisma";

describe("contextResolver — Milestone A (A3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty context when url is empty or null", async () => {
    const res = await resolvePageContext("org-123", null);
    expect(res.pageType).toBeNull();
    expect(res.product).toBeNull();
    expect(buildContextHint(res)).toBeNull();
  });

  it("resolves a product page and extracts active product details", async () => {
    const mockPage = {
      pageType: "PRODUCT",
      title: "Nike Air Max 270",
      url: "https://store.com/products/nike-air-max-270",
      canonicalUrl: "https://store.com/products/nike-air-max-270",
      metadata: {},
    };

    const mockProduct = {
      id: "prod-999",
      name: "Nike Air Max 270",
      price: 95000,
      currency: "NGN",
      categoryId: "cat-shoes",
      category: { id: "cat-shoes", name: "Shoes" },
      brand: "Nike",
      inventoryStatus: "IN_STOCK",
      sourceUrl: "https://store.com/products/nike-air-max-270",
    };

    vi.mocked(prisma.websitePage.findFirst).mockResolvedValueOnce(mockPage as any);
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(mockProduct as any);

    const res = await resolvePageContext(
      "org-123",
      "https://store.com/products/nike-air-max-270?utm_source=google"
    );

    expect(res.pageType).toBe("PRODUCT");
    expect(res.product).not.toBeNull();
    expect(res.product?.name).toBe("Nike Air Max 270");
    expect(res.product?.price).toBe(95000);
    expect(res.product?.categoryName).toBe("Shoes");

    const hint = buildContextHint(res);
    expect(hint).toContain('viewing the product: "Nike Air Max 270"');
    expect(hint).toContain("NGN 95,000");
  });

  it("resolves a category page context", async () => {
    const mockPage = {
      pageType: "CATEGORY",
      title: "Men's Sneakers",
      url: "https://store.com/collections/sneakers",
      canonicalUrl: "https://store.com/collections/sneakers",
      metadata: { categoryName: "Sneakers" },
    };

    vi.mocked(prisma.websitePage.findFirst).mockResolvedValueOnce(mockPage as any);
    vi.mocked(prisma.category.findFirst).mockResolvedValueOnce({
      id: "cat-snk",
      name: "Sneakers",
    } as any);

    const res = await resolvePageContext("org-123", "https://store.com/collections/sneakers");

    expect(res.pageType).toBe("CATEGORY");
    expect(res.categoryName).toBe("Sneakers");
    expect(res.categoryId).toBe("cat-snk");

    const hint = buildContextHint(res);
    expect(hint).toContain('browsing the category: "Sneakers"');
  });
});
