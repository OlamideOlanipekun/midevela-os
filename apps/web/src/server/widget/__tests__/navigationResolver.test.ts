import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractNavigationTarget, resolveNavigation } from "../navigationResolver";

vi.mock("@/lib/prisma", () => {
  return {
    default: {
      category: {
        findMany: vi.fn(),
      },
      websitePage: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

import prisma from "@/lib/prisma";

describe("navigationResolver — Milestone A (A6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractNavigationTarget", () => {
    it("extracts target category/page label from natural language queries", () => {
      expect(extractNavigationTarget("Take me to men's shoes")).toBe("men's shoes");
      expect(extractNavigationTarget("Go to the shipping page")).toBe("shipping");
      expect(extractNavigationTarget("Navigate to collections")).toBe("collections");
      expect(extractNavigationTarget("Show me sneakers")).toBe("sneakers");
    });

    it("returns null for non-navigation queries", () => {
      expect(extractNavigationTarget("Do you have something under 100k?")).toBeNull();
      expect(extractNavigationTarget("which one is better?")).toBeNull();
      expect(extractNavigationTarget("hello")).toBeNull();
    });
  });

  describe("resolveNavigation", () => {
    it("resolves category query to verified category URL", async () => {
      const mockCategories = [
        { id: "cat-1", name: "Men's Shoes", slug: "mens-shoes" },
        { id: "cat-2", name: "Women's Clothing", slug: "womens-clothing" },
      ];

      const mockPage = {
        url: "https://store.com/collections/mens-shoes",
        canonicalUrl: "https://store.com/collections/mens-shoes",
      };

      vi.mocked(prisma.category.findMany).mockResolvedValueOnce(mockCategories as any);
      vi.mocked(prisma.websitePage.findFirst).mockResolvedValueOnce(mockPage as any);

      const res = await resolveNavigation("org-123", "men's shoes");

      expect(res).not.toBeNull();
      expect(res?.targetUrl).toBe("https://store.com/collections/mens-shoes");
      expect(res?.targetTitle).toBe("Men's Shoes");
      expect(res?.pageType).toBe("CATEGORY");
      expect(res?.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("resolves policy query to verified shipping policy page", async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.websitePage.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.websitePage.findFirst).mockResolvedValueOnce({
        url: "https://store.com/pages/shipping-policy",
        canonicalUrl: "https://store.com/pages/shipping-policy",
        title: "Shipping & Delivery Policy",
        pageType: "POLICY",
      } as any);

      const res = await resolveNavigation("org-123", "shipping");

      expect(res).not.toBeNull();
      expect(res?.targetUrl).toBe("https://store.com/pages/shipping-policy");
      expect(res?.pageType).toBe("POLICY");
    });
  });
});
