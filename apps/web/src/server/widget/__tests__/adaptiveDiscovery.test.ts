import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM so we control extraction + semantic resolution responses
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

const defaultCategories = [
  { id: "cat-moisturizer", name: "Moisturizers", icon: "💧" },
  { id: "cat-serum", name: "Serums", icon: "✨" },
  { id: "cat-cleanser", name: "Cleansers", icon: "🧼" },
  { id: "cat-laptop", name: "Laptops", icon: "💻" },
  { id: "cat-skincare", name: "Skincare", icon: "🧴" },
  { id: "cat-makeup", name: "Makeup", icon: "💄" },
  { id: "cat-footwear", name: "Footwear", icon: "👟" },
  { id: "cat-hair", name: "Hair Care", icon: "💇" },
  { id: "cat-electronics", name: "Electronics", icon: "📱" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListCategories.mockResolvedValue(defaultCategories);
});

// Helper: default semantic response that returns the same category
function semanticMatch(categoryName: string) {
  return {
    raw: JSON.stringify({ matchedCategory: categoryName, ambiguousCategories: [] }),
  };
}

// ── Complete request in one message ─────────────────────────────────────────

describe("complete request in one message", () => {
  it("returns immediate recommendations when all info is provided", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "Moisturizers",
          budget: { min: 0, max: 50000 }, brand: null, purpose: "dry skin", attributes: { skinType: "dry" },
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Moisturizers"));
    mockRecommend.mockResolvedValue([
      { id: "p1", name: "Hydrating Moisturizer", brand: "BrandA", price: "₦25,000", imageUrl: null, url: null, inStock: true },
      { id: "p2", name: "Rich Night Cream", brand: "BrandB", price: "₦45,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery("org-1", "I need a moisturizer for dry skin under ₦50,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(result!.recommendations).toHaveLength(2);
    expect(result!.recommendations[0].name).toBe("Hydrating Moisturizer");
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
        hasShoppingIntent: true, categoryName: null,
        budget: { min: 0, max: 30000 }, brand: null, purpose: null, attributes: {},
      }),
    });

    const result = await tryAdaptiveDiscovery("org-1", "Something under ₦30,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(result!.recommendations).toHaveLength(0);
    expect(result!.replyText).toContain("What type of product");
  });

  it("asks for budget when only category is provided and no existing context", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "Cleansers",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Cleansers"));

    const result = await tryAdaptiveDiscovery("org-1", "I want a cleanser", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(result!.replyText).toContain("budget");
  });
});

// ── Multiple requirements in one message ───────────────────────────────────

describe("multiple requirements in one message", () => {
  it("extracts category, budget, brand, and purpose from a rich message", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "Serums",
          budget: { min: 0, max: 60000 }, brand: "BrandC", purpose: "anti-aging", attributes: { concern: "wrinkles" },
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Serums"));
    mockRecommend.mockResolvedValue([
      { id: "p3", name: "Anti-Aging Serum", brand: "BrandC", price: "₦55,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1", "I'm looking for an anti-aging serum from BrandC, under ₦60,000", null,
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
    const existing: ShoppingContext = { categoryName: "Moisturizers", budget: "100000-200000" };

    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: null,
          budget: { min: 0, max: 30000 }, brand: null, purpose: null, attributes: {},
        }),
      });
    // For the semantic resolution call — uses merged.categoryName from existing context
    // But wait: merged.categoryName = existing.categoryName = "Moisturizers"
    // But the extraction returned categoryName: null, so the semantic resolver
    // will be called with the existing category. Let me check the code flow...
    // Actually, when extraction returns categoryName: null AND existing has categoryName,
    // mergeRequirements sets merged.categoryName = existing.categoryName.
    // Then the code checks if (merged.categoryName) and calls resolveCategorySemantically.
    // But wait — the existing category was ALREADY resolved in a previous turn.
    // We shouldn't need to re-resolve it. But the current code doesn't distinguish
    // between newly extracted vs existing category — it resolves both.
    // This is actually fine because the semantic resolver will match "Moisturizers" → Moisturizers.

    // Actually wait — the extraction above returns categoryName: null, so extracted.categoryName is null.
    // In mergeRequirements, merged.categoryName = existing.categoryName = "Moisturizers".
    // Then in the main function, merged.categoryName is truthy, so we call resolveCategorySemantically.
    // The semantic resolver uses shopperIntent = extracted.categoryName || merged.categoryName = "Moisturizers".
    // We need a mock response for this call.
    mockCompleteJson.mockResolvedValueOnce(semanticMatch("Moisturizers"));

    mockRecommend.mockResolvedValue([
      { id: "p4", name: "Budget Moisturizer", brand: "BrandD", price: "₦25,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1", "Actually, I want something cheaper, under ₦30,000", existing,
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
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
    const existing: ShoppingContext = { categoryName: "Moisturizers", budget: "0-50000" };

    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "Serums",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Serums"));
    mockRecommend.mockResolvedValue([
      { id: "p5", name: "Brightening Serum", brand: "BrandE", price: "₦35,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1", "Actually, show me serums instead", existing,
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
        hasShoppingIntent: false, categoryName: null,
        budget: null, brand: null, purpose: null, attributes: {},
      }),
    });

    const result = await tryAdaptiveDiscovery("org-1", "What's the best product you have?", null);

    expect(result).toBeNull();
  });
});

// ── Unrelated answer during qualification ─────────────────────────────────

describe("user provides answer unrelated to current qualification step", () => {
  it("still extracts shopping requirements and recommends if possible", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "Moisturizers",
          budget: null, brand: "BrandF", purpose: "hydration", attributes: { skinType: "dry" },
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Moisturizers"));
    mockRecommend.mockResolvedValue([
      { id: "p6", name: "Hydra Moisturizer", brand: "BrandF", price: "₦28,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1", "I actually want a moisturizer from BrandF for dry skin", { categoryName: "Moisturizers" },
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
  });
});

// ── No matching products ───────────────────────────────────────────────────

describe("no matching products", () => {
  it("returns a polite message when no products match", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "Laptops",
          budget: { min: 0, max: 50000 }, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Laptops"));
    mockRecommend.mockResolvedValue([]);

    const result = await tryAdaptiveDiscovery("org-1", "I need a laptop under ₦50,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(result!.recommendations).toHaveLength(0);
    expect(result!.replyText).toContain("couldn't find any products");
  });
});

// ── Real product grounding (LLM recommends → engine grounds) ───────────────

describe("real product grounding", () => {
  it("only returns products that exist in the database", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "Moisturizers",
          budget: null, brand: null, purpose: "dry skin", attributes: { skinType: "dry" },
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Moisturizers"));
    mockRecommend.mockResolvedValue([
      { id: "real-1", name: "Real Moisturizer", brand: "BrandG", price: "₦15,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery("org-1", "I need a moisturizer for dry skin", null);

    expect(result).not.toBeNull();
    expect(result!.recommendations).toHaveLength(1);
    expect(result!.recommendations[0].id).toBe("real-1");
    expect(result!.recommendations.every((r) => r.id && r.name && r.price)).toBe(true);
  });
});

// ── Existing guided qualification flow still works ─────────────────────────

describe("existing guided qualification flow regression", () => {
  it("does not interfere when no shopping intent is detected", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        hasShoppingIntent: false, categoryName: null,
        budget: null, brand: null, purpose: null, attributes: {},
      }),
    });

    const result = await tryAdaptiveDiscovery(
      "org-1", "Thanks! How long does shipping usually take?",
      { categoryName: "Moisturizers", budget: "0-50000" },
    );

    expect(result).toBeNull();
  });

  it("extraction LLM failure falls through gracefully", async () => {
    mockCompleteJson.mockRejectedValue(new Error("LLM API error"));

    const result = await tryAdaptiveDiscovery("org-1", "I need a moisturizer", null);

    expect(result).toBeNull();
  });

  it("extraction parse failure falls through gracefully", async () => {
    mockCompleteJson.mockResolvedValue({ raw: "not valid json at all" });

    const result = await tryAdaptiveDiscovery("org-1", "I need a moisturizer", null);

    expect(result).toBeNull();
  });
});

// ── Merge requirements ─────────────────────────────────────────────────────

describe("mergeRequirements", () => {
  it("extracted requirements merge with existing context", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: null,
          budget: null, brand: null, purpose: "acne treatment", attributes: { concern: "acne" },
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Moisturizers"));
    mockRecommend.mockResolvedValue([
      { id: "p7", name: "Acne Cream", brand: "BrandH", price: "₦12,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery(
      "org-1", "I need something for acne",
      { categoryName: "Moisturizers", budget: "0-50000" },
    );

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "cat-moisturizer",
        answers: expect.objectContaining({ budget: "0-50000", purpose: "acne treatment" }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── SEMANTIC CATEGORY RESOLUTION TESTS ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

describe("semantic category resolution", () => {
  it('maps "skin care" → Skincare', async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "skin care",
          budget: { min: 0, max: 30000 }, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Skincare"));
    mockRecommend.mockResolvedValue([
      { id: "sc1", name: "Face Cream", brand: "BrandX", price: "₦15,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery("org-1", "I need skin care under ₦30,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cat-skincare" }),
    );
  });

  it('maps "face products" → Skincare', async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "face products",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Skincare"));

    const result = await tryAdaptiveDiscovery("org-1", "Show me face products", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    // Should ask for budget since we have category + no budget yet
    expect(result!.replyText).toContain("budget");
  });

  it('maps "running shoes" → Footwear', async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "running shoes",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Footwear"));

    const result = await tryAdaptiveDiscovery("org-1", "I need running shoes", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(mockCompleteJson).toHaveBeenCalledTimes(2);
  });

  it('maps "lipstick" → Makeup', async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "lipstick",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Makeup"));

    const result = await tryAdaptiveDiscovery("org-1", "I want a lipstick", null);

    expect(result).not.toBeNull();
    // Should ask for budget next
    expect(result!.replyText).toContain("budget");
  });

  it('maps "hair cream" → Hair Care', async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "hair cream",
          budget: { min: 0, max: 10000 }, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Hair Care"));
    mockRecommend.mockResolvedValue([
      { id: "hc1", name: "Hair Cream", brand: "BrandY", price: "₦5,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery("org-1", "Hair cream under ₦10,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cat-hair" }),
    );
  });

  it('maps "phone charger" → Electronics', async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "phone charger",
          budget: { min: 0, max: 5000 }, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce(semanticMatch("Electronics"));
    mockRecommend.mockResolvedValue([
      { id: "el1", name: "USB Charger", brand: "BrandZ", price: "₦3,000", imageUrl: null, url: null, inStock: true },
    ]);

    const result = await tryAdaptiveDiscovery("org-1", "Phone charger under ₦5,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(true);
    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cat-electronics" }),
    );
  });
});

// ── Ambiguous category ────────────────────────────────────────────────────

describe("ambiguous category resolution", () => {
  it("asks shopper to choose when two categories are equally close", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "beauty product",
          budget: { min: 0, max: 50000 }, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          matchedCategory: "__ambiguous__",
          ambiguousCategories: ["Skincare", "Makeup"],
        }),
      });

    const result = await tryAdaptiveDiscovery("org-1", "I want a beauty product under ₦50,000", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(result!.recommendations).toHaveLength(0);
    expect(result!.replyText).toContain("Skincare");
    expect(result!.replyText).toContain("Makeup");
  });

  it("asks a generic question when ambiguous categories list is empty", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "stuff",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          matchedCategory: "__ambiguous__",
          ambiguousCategories: [],
        }),
      });

    const result = await tryAdaptiveDiscovery("org-1", "I need some stuff", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(result!.replyText).toBe("Which category did you have in mind?");
  });
});

// ── No reasonable match ────────────────────────────────────────────────────

describe("no reasonable semantic match", () => {
  it("politely says no matching category when AI returns null", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "spaceship",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce({
        raw: JSON.stringify({ matchedCategory: null, ambiguousCategories: [] }),
      });

    const result = await tryAdaptiveDiscovery("org-1", "I want a spaceship", null);

    expect(result).not.toBeNull();
    expect(result!.fromEngine).toBe(false);
    expect(result!.recommendations).toHaveLength(0);
    expect(result!.replyText).toContain("couldn't find a category");
    expect(result!.replyText).toContain("spaceship");
  });

  it("politely says no matching category when AI returns 'none'", async () => {
    mockCompleteJson
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          hasShoppingIntent: true, categoryName: "unicorn food",
          budget: null, brand: null, purpose: null, attributes: {},
        }),
      })
      .mockResolvedValueOnce({
        raw: JSON.stringify({ matchedCategory: "none", ambiguousCategories: [] }),
      });

    const result = await tryAdaptiveDiscovery("org-1", "Unicorn food?", null);

    expect(result).not.toBeNull();
    expect(result!.replyText).toContain("couldn't find a category");
  });
});
