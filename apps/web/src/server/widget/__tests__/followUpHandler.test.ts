import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM
vi.mock("@/server/conversation/llm", () => ({
  completeJson: vi.fn(),
}));

// Mock Prisma for product lookups
vi.mock("@/lib/prisma", () => ({
  default: {
    product: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock the compare engine
vi.mock("@/server/widget/compare", () => ({
  compareProducts: vi.fn(),
}));

import { completeJson } from "@/server/conversation/llm";
import prisma from "@/lib/prisma";
import { compareProducts } from "@/server/widget/compare";
import { classifyFollowUpIntent, handleFollowUp } from "../followUpHandler";
import type { RecommendedProduct } from "../recommend";
import type { ShoppingContext } from "@/server/conversation/engine";

const mockCompleteJson = completeJson as unknown as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.product.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockCompare = compareProducts as unknown as ReturnType<typeof vi.fn>;

const sampleRecs: RecommendedProduct[] = [
  { id: "p1", name: "Hydrating Moisturizer", brand: "BrandA", price: "₦25,000", imageUrl: null, url: null, inStock: true },
  { id: "p2", name: "Rich Night Cream", brand: "BrandB", price: "₦45,000", imageUrl: null, url: null, inStock: true },
  { id: "p3", name: "Brightening Serum", brand: "BrandC", price: "₦35,000", imageUrl: null, url: null, inStock: true },
];

const emptyContext: ShoppingContext = {};

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// ── CLASSIFIER TESTS ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

describe("classifyFollowUpIntent", () => {
  it("returns null when there are no recommendations", async () => {
    const result = await classifyFollowUpIntent("tell me more", []);
    expect(result).toBeNull();
  });

  it("returns null when the LLM call fails", async () => {
    mockCompleteJson.mockRejectedValue(new Error("LLM error"));
    const result = await classifyFollowUpIntent("tell me more", sampleRecs);
    expect(result).toBeNull();
  });

  it("classifies 'tell me more' as product_details", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "product_details",
        targetProductName: "first",
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("tell me more", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("product_details");
    expect(result!.targetProductName).toBe("first");
  });

  it("classifies 'more details' as product_details", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "product_details",
        targetProductName: "first",
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("more details", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("product_details");
  });

  it("classifies 'is it good for oily skin' as product_details", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "product_details",
        targetProductName: "Hydrating Moisturizer",
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("is the moisturizer good for oily skin?", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("product_details");
    expect(result!.targetProductName).toBe("Hydrating Moisturizer");
  });

  it("classifies 'what's the difference' as compare", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "compare",
        targetProductName: null,
        compareProductNames: ["Hydrating Moisturizer", "Rich Night Cream"],
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("what's the difference between the first two?", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("compare");
    expect(result!.compareProductNames).toHaveLength(2);
  });

  it("classifies 'which is better' as compare", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "compare",
        targetProductName: null,
        compareProductNames: ["first", "last"],
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("which is better?", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("compare");
  });

  it("classifies 'show me cheaper ones' as constraint_change", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "constraint_change",
        targetProductName: null,
        compareProductNames: null,
        constraintCategory: "budget",
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("show me cheaper ones", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("constraint_change");
    expect(result!.constraintCategory).toBe("budget");
  });

  it("classifies 'I want a different brand' as constraint_change", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "constraint_change",
        targetProductName: null,
        compareProductNames: null,
        constraintCategory: "brand",
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("I want a different brand", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("constraint_change");
  });

  it("classifies 'recommend one' as product_details", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "product_details",
        targetProductName: "first",
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("recommend one for me", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("product_details");
  });

  it("classifies 'does it come in another color' as product_details", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "product_details",
        targetProductName: "first",
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("does it come in another color?", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("product_details");
  });

  it("classifies 'is it available' as product_details", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "product_details",
        targetProductName: "Hydrating Moisturizer",
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("is the moisturizer available?", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("product_details");
  });

  it("classifies 'thanks' as unrelated", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "unrelated",
        targetProductName: null,
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("thanks!", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("unrelated");
  });

  it("classifies 'how does shipping work' as unrelated", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "unrelated",
        targetProductName: null,
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("how does shipping work?", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("unrelated");
  });

  it("classifies 'show me laptops instead' as new_search", async () => {
    mockCompleteJson.mockResolvedValue({
      raw: JSON.stringify({
        type: "new_search",
        targetProductName: null,
        compareProductNames: null,
        constraintCategory: null,
        constraintValue: null,
      }),
    });

    const result = await classifyFollowUpIntent("show me laptops instead", sampleRecs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("new_search");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── HANDLER TESTS ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

describe("handleFollowUp — product_details", () => {
  it("returns product details from the database", async () => {
    mockFindFirst.mockResolvedValue({
      id: "p1",
      name: "Hydrating Moisturizer",
      brand: "BrandA",
      description: "A rich hydrating formula",
      aiDescription: "Great for dry skin",
      price: "25000",
      currency: "NGN",
      attributes: { skinType: "dry", size: "50ml" },
      inventoryStatus: "IN_STOCK",
    });
    mockCompleteJson.mockResolvedValue({ raw: "This moisturizer is great for dry skin and costs ₦25,000." });

    const classification = {
      type: "product_details" as const,
      targetProductName: "first",
      userMessage: "tell me more",
    };

    const result = await handleFollowUp("org-1", classification, sampleRecs, emptyContext);

    expect(result).not.toBeNull();
    expect(result!.replyText).toBe("This moisturizer is great for dry skin and costs ₦25,000.");
    expect(result!.recommendations).toBe(sampleRecs);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", orgId: "org-1" } }),
    );
  });

  it("asks which product when resolution fails", async () => {
    const result = await handleFollowUp(
      "org-1",
      { type: "product_details", targetProductName: "nonexistent", userMessage: "tell me more" },
      sampleRecs,
      emptyContext,
    );

    expect(result).not.toBeNull();
    expect(result!.replyText).toBe("Which product would you like to know more about?");
  });

  it("falls back to product summary when LLM call fails", async () => {
    mockFindFirst.mockResolvedValue({
      id: "p1",
      name: "Hydrating Moisturizer",
      brand: "BrandA",
      description: "A rich hydrating formula",
      aiDescription: null,
      price: "25000",
      currency: "NGN",
      attributes: {},
      inventoryStatus: "IN_STOCK",
    });
    mockCompleteJson.mockRejectedValue(new Error("LLM error"));

    const result = await handleFollowUp(
      "org-1",
      { type: "product_details", targetProductName: "first", userMessage: "tell me more" },
      sampleRecs,
      emptyContext,
    );

    expect(result).not.toBeNull();
    expect(result!.replyText).toContain("Hydrating Moisturizer");
    expect(result!.replyText).toContain("₦25,000");
  });
});

describe("handleFollowUp — compare", () => {
  it("returns comparison of two products", async () => {
    mockCompare.mockResolvedValue({
      products: [
        { id: "p1", name: "Hydrating Moisturizer", price: "₦25,000" },
        { id: "p2", name: "Rich Night Cream", price: "₦45,000" },
      ],
      rows: [
        { label: "Price", values: ["₦25,000", "₦45,000"] },
        { label: "Skin Type", values: ["dry", "all"] },
      ],
      recommendation: "The Hydrating Moisturizer is better for dry skin.",
    });

    const result = await handleFollowUp(
      "org-1",
      {
        type: "compare",
        compareProductNames: ["Hydrating Moisturizer", "Rich Night Cream"],
        userMessage: "compare them",
      },
      sampleRecs,
      emptyContext,
    );

    expect(result).not.toBeNull();
    expect(result!.replyText).toContain("₦25,000 vs ₦45,000");
    expect(result!.replyText).toContain("Hydrating Moisturizer is better");
  });

  it("uses first two products when no specific names given", async () => {
    mockCompare.mockResolvedValue({
      products: [
        { id: "p1", name: "Hydrating Moisturizer", price: "₦25,000" },
        { id: "p2", name: "Rich Night Cream", price: "₦45,000" },
      ],
      rows: [{ label: "Price", values: ["₦25,000", "₦45,000"] }],
      recommendation: "Both are solid options.",
    });

    const result = await handleFollowUp(
      "org-1",
      { type: "compare", userMessage: "compare them" },
      sampleRecs,
      emptyContext,
    );

    expect(result).not.toBeNull();
    expect(mockCompare).toHaveBeenCalledWith("org-1", ["p1", "p2"]);
  });

  it("says it needs two products when only one exists", async () => {
    const singleRec = [sampleRecs[0]];

    const result = await handleFollowUp(
      "org-1",
      { type: "compare", compareProductNames: ["Hydrating Moisturizer"], userMessage: "compare" },
      singleRec,
      emptyContext,
    );

    expect(result).not.toBeNull();
    expect(result!.replyText).toContain("two products");
  });
});

describe("handleFollowUp — constraint_change", () => {
  it("returns a response for vague budget change", async () => {
    const result = await handleFollowUp(
      "org-1",
      {
        type: "constraint_change",
        constraintCategory: "budget",
        constraintValue: undefined,
        userMessage: "show me cheaper ones",
      },
      sampleRecs,
      emptyContext,
    );

    expect(result).not.toBeNull();
    expect(result!.replyText).toContain("₦20k");
  });
});

describe("handleFollowUp — new_search and unrelated", () => {
  it("returns null for new_search to fall through to adaptive discovery", async () => {
    const result = await handleFollowUp(
      "org-1",
      { type: "new_search", userMessage: "show me laptops instead" },
      sampleRecs,
      emptyContext,
    );
    expect(result).toBeNull();
  });

  it("returns null for unrelated to fall through to normal chat", async () => {
    const result = await handleFollowUp(
      "org-1",
      { type: "unrelated", userMessage: "thanks!" },
      sampleRecs,
      emptyContext,
    );
    expect(result).toBeNull();
  });
});
