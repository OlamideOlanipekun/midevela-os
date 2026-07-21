import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM so we control extraction responses
vi.mock("@/server/conversation/llm", () => ({
  completeJson: vi.fn(),
}));

// Mock category listing
vi.mock("@/server/catalog/categories", () => ({
  listCategoriesForWidget: vi.fn(),
}));

// Mock the deterministic product engine
vi.mock("@/server/widget/recommend", () => ({
  recommendProducts: vi.fn(),
}));

import { completeJson } from "@/server/conversation/llm";
import { listCategoriesForWidget } from "@/server/catalog/categories";
import { recommendProducts } from "@/server/widget/recommend";
import { tryAdaptiveDiscovery } from "../adaptiveDiscovery";
import type { ShoppingContext } from "@/server/conversation/engine";

const mockCompleteJson = completeJson as unknown as ReturnType<typeof vi.fn>;
const mockListCategories = listCategoriesForWidget as unknown as ReturnType<typeof vi.fn>;
const mockRecommend = recommendProducts as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockListCategories.mockResolvedValue([
    { id: "cat-moisturizer", name: "Moisturizers", icon: "💧" },
    { id: "cat-serum", name: "Serums", icon: "✨" },
    { id: "cat-cleanser", name: "Cleansers", icon: "🧼" },
    { id: "cat-laptop", name: "Laptops", icon: "💻" },
  ]);
});

// ── Complete request in one message ─────────────────────────────────────────

describe("complete request in one message", () => {
  it("returns immediate recommendations when all info is provided", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: "Moisturizers",
        budget: { min: 0, max: 50000 },
        brand: null,
        purpose: "dry skin",
        attributes: { skinType: "dry" },
      }),
    });
    mockRecommend.mockResolvedValue([
      { id: "p1", name: "Hydrating Moisturizer", brand: "BrandA", price: "₦25,000", imageUrl: null, url: null, inStock: true },
      { id: "p2", name: "Rich Night Cream", brand: "BrandB", price: "₦45,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery("org-1", "I need a moisturizer for dry skin under ₦50,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(result!.recommendations).toHaveLength(2);
    expect(result!.recommendations[0].name).toBe("Hydrating Moisturizer");
    expect(result!.replyText).toContain("Hydrating Moisturizer");
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", categoryId: "cat-moisturizer" }),
    );
  });
});

// ── Partial request → follow-up ────────────────────────────────────────────

describe("partial request — one follow-up", () => {
  it("asks for category when only budget is provided", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: null,
        budget: { min: 0, max: 30000 },
        brand: null,
        purpose: null,
        attributes: {},
      }),
    });

    const result = await tryAdaptiveDiscovery("org-1", "Something under ₦30,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(result!.recommendations).toHaveLength(0);
    expect(result!.replyText).toContain("What type of product");
  });

  it("asks for budget when only category is provided and no existing context", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: "Cleansers",
        budget: null,
        brand: null,
        purpose: null,
        attributes: {},
      }),
    });

    const result = await tryAdaptiveDiscovery("org-1", "I want a cleanser", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(result!.replyText).toContain("budget");
  });
});

// ── Multiple requirements in one message ───────────────────────────────────

describe("multiple requirements in one message", () => {
  it("extracts category, budget, brand, and purpose from a rich message", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: "Serums",
        budget: { min: 0, max: 60000 },
        brand: "BrandC",
        purpose: "anti-aging",
        attributes: { concern: "wrinkles" },
      }),
    });
    mockRecommend.mockResolvedValue([
      { id: "p3", name: "Anti-Aging Serum", brand: "BrandC", price: "₦55,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "I'm looking for an anti-aging serum from BrandC, under ₦60,000",
      null,
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(result!.recommendations).toHaveLength(1);
    expect(result!.recommendations[0].name).toBe("Anti-Aging Serum");
  });
});

// ── User changes budget ────────────────────────────────────────────────────

describe("user changes their budget", () => {
  it("uses the new budget from the message over an existing one", async () => {
    const existing: ShoppingContext = {
      categoryName: "Moisturizers",
      budget: "100000-200000",
    };

    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: null,
        budget: { min: 0, max: 30000 },
        brand: null,
        purpose: null,
        attributes: {},
      }),
    });
    mockRecommend.mockResolvedValue([
      { id: "p4", name: "Budget Moisturizer", brand: "BrandD", price: "₦25,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "Actually, I want something cheaper, under ₦30,000",
      existing,
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    // Should have used the NEW budget (₦30,000) not the old one (₦100k–₦200k)
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({ budget: "0-30000" }),
      }),
    );
  });
});

// ── User changes category ──────────────────────────────────────────────────

describe("user changes product category", () => {
  it("uses the new category from the message", async () => {
    const existing: ShoppingContext = {
      categoryName: "Moisturizers",
      budget: "0-50000",
    };

    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: "Serums",
        budget: null,
        brand: null,
        purpose: null,
        attributes: {},
      }),
    });
    mockRecommend.mockResolvedValue([
      { id: "p5", name: "Brightening Serum", brand: "BrandE", price: "₦35,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "Actually, show me serums instead",
      existing,
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cat-serum" }),
    );
  });
});

// ── Ambiguous / "I don't know" ────────────────────────────────────────────

describe("user says show me the best one / I don't know", () => {
  it("falls through to normal chat when no specific shopping intent detected", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: false,
        categoryName: null,
        budget: null,
        brand: null,
        purpose: null,
        attributes: {},
      }),
    });

    const result = await tryAdaptiveDiscovery("org-1", "What's the best product you have?", null);

    // No shopping intent detected → fall through to normal chat
    expect(result).toBeNull();
  });
});

// ── Unrelated answer during qualification ─────────────────────────────────

describe("user provides answer unrelated to current qualification step", () => {
  it("still extracts shopping requirements and recommends if possible", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: "Moisturizers",
        budget: null,
        brand: "BrandF",
        purpose: "hydration",
        attributes: { skinType: "dry" },
      }),
    });
    mockRecommend.mockResolvedValue([
      { id: "p6", name: "Hydra Moisturizer", brand: "BrandF", price: "₦28,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "I actually want a moisturizer from BrandF for dry skin",
      { categoryName: "Moisturizers" },
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
  });
});

// ── No matching products ───────────────────────────────────────────────────

describe("no matching products", () => {
  it("returns a polite message when no products match", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: "Laptops",
        budget: { min: 0, max: 50000 },
        brand: null,
        purpose: null,
        attributes: {},
      }),
    });
    mockRecommend.mockResolvedValue([]);

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "I need a laptop under ₦50,000",
      null,
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(result!.recommendations).toHaveLength(0);
    expect(result!.replyText).toContain("couldn't find any products");
  });
});

// ── Real product grounding (LLM recommends → engine grounds) ───────────────

describe("real product grounding", () => {
  it("only returns products that exist in the database", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: "Moisturizers",
        budget: null,
        brand: null,
        purpose: "dry skin",
        attributes: { skinType: "dry" },
      }),
    });
    // The engine only returns real DB products — it never invents them
    mockRecommend.mockResolvedValue([
      { id: "real-1", name: "Real Moisturizer", brand: "BrandG", price: "₦15,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery("org-1", "I need a moisturizer for dry skin", null);

    expect(result).not.toBeNull();
    expect(result!.recommendations).toHaveLength(1);
    expect(result!.recommendations[0].id).toBe("real-1");
    // No hallucinated products
    expect(result!.recommendations.every((r) => r.id && r.name && r.price)).toBe(true);
  });
});

// ── Existing guided qualification flow still works ─────────────────────────

describe("existing guided qualification flow regression", () => {
  it("does not interfere when no shopping intent is detected", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: false,
        categoryName: null,
        budget: null,
        brand: null,
        purpose: null,
        attributes: {},
      }),
    });

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "Thanks! How long does shipping usually take?",
      { categoryName: "Moisturizers", budget: "0-50000" },
    );

    // Non-shopping query falls through to normal chat
    expect(result).toBeNull();
  });

  it("extraction LLM failure falls through gracefully", async () => {
    mockCompleteJson.mockRejectedValue(new Error("LLM API error"));

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "I need a moisturizer",
      null,
    );

    // Failure during extraction falls through to normal chat
    expect(result).toBeNull();
  });

  it("extraction parse failure falls through gracefully", async () => {
    mockCompleteJson.mockResolvedValue({ raw: "not valid json at all" });

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "I need a moisturizer",
      null,
    );

    expect(result).toBeNull();
  });
});

// ── Merge requirements ─────────────────────────────────────────────────────

describe("mergeRequirements", () => {
  // Import the pure function for direct testing
  // We test it through tryAdaptiveDiscovery by controlling the LLM output

  it("extracted requirements merge with existing context", async () => {
    // Existing context: category + budget
    // New message: adds purpose only
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: true,
        categoryName: null, // already known, not re-extracted
        budget: null, // already known, not re-extracted
        brand: null,
        purpose: "acne treatment",
        attributes: { concern: "acne" },
      }),
    });
    mockRecommend.mockResolvedValue([
      { id: "p7", name: "Acne Cream", brand: "BrandH", price: "₦12,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1",
      "I need something for acne",
      { categoryName: "Moisturizers", budget: "0-50000" },
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    // Should have called recommend with merged context (existing category + budget + new purpose)
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "cat-moisturizer",
        answers: expect.objectContaining({
          budget: "0-50000",
          purpose: "acne treatment",
        }),
      }),
    );
  });
});
