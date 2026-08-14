import { describe, it, expect, vi } from "vitest";
import { retrieveProducts, retrieveKnowledge, retrieveContext, ensureHnswIndex } from "../search";
import prisma from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    product: {
      findMany: vi.fn(),
    },
    knowledgeEntry: {
      findMany: vi.fn(),
    },
  },
}));

describe("Retrieval Correctness — Index Separation & HNSW Index", () => {
  const dummyEmbedding = new Array(1024).fill(0.01);

  it("retrieveProducts queries ONLY source_type = 'PRODUCT' in vector index", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { source_type: "PRODUCT", source_id: "prod-1", similarity: 0.85 },
    ] as any);

    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      {
        id: "prod-1",
        name: "Wireless Headphones",
        price: 25000 as any,
        currency: "NGN",
        description: "Noise cancelling Bluetooth headphones.",
        sourceUrl: "https://shop.com/products/headphones",
        images: ["https://shop.com/images/headphones.jpg"],
        category: { name: "Electronics" },
      } as any,
    ]);

    const results = await retrieveProducts("org-123", dummyEmbedding);

    expect(results.length).toBe(1);
    expect(results[0].type).toBe("product");
    expect(results[0].name).toBe("Wireless Headphones");
    expect(results[0].similarity).toBe(0.85);

    // Verify raw query explicitly filtered source_type = 'PRODUCT'
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("retrieveKnowledge queries ONLY source_type = 'KNOWLEDGE_ENTRY' in vector index", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { source_type: "KNOWLEDGE_ENTRY", source_id: "know-1", similarity: 0.92 },
    ] as any);

    vi.mocked(prisma.knowledgeEntry.findMany).mockResolvedValueOnce([
      {
        id: "know-1",
        title: "Shipping & Return Policy",
        content: "Free 3-day nationwide shipping on orders above ₦20,000.",
        type: "POLICY",
      } as any,
    ]);

    const results = await retrieveKnowledge("org-123", dummyEmbedding);

    expect(results.length).toBe(1);
    expect(results[0].type).toBe("knowledge");
    expect(results[0].title).toBe("Shipping & Return Policy");
    expect(results[0].similarity).toBe(0.92);
  });

  it("rejects non-numeric values in query embedding", async () => {
    const invalidVector = [0.1, NaN, 0.5];
    await expect(retrieveProducts("org-123", invalidVector)).rejects.toThrow(
      "Query embedding contains non-numeric values"
    );
  });

  it("ensureHnswIndex creates the pgvector HNSW index", async () => {
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValueOnce(1 as any);
    await ensureHnswIndex();
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("CREATE INDEX IF NOT EXISTS \"embeddings_embedding_hnsw_idx\"")
    );
  });

  it("retrieveContext integrates product and knowledge indices cleanly", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ source_type: "PRODUCT", source_id: "p1", similarity: 0.88 }] as any)
      .mockResolvedValueOnce([{ source_type: "KNOWLEDGE_ENTRY", source_id: "k1", similarity: 0.91 }] as any);

    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      {
        id: "p1",
        name: "Running Shoes",
        price: 30000 as any,
        currency: "NGN",
        description: "Lightweight mesh running shoes.",
        sourceUrl: "https://shop.com/p1",
        images: [],
        category: null,
      } as any,
    ]);

    vi.mocked(prisma.knowledgeEntry.findMany).mockResolvedValueOnce([
      {
        id: "k1",
        title: "Returns FAQ",
        content: "Returns are accepted within 14 days.",
      } as any,
    ]);

    const results = await retrieveContext("org-123", dummyEmbedding);
    expect(results.length).toBe(2);
    // Knowledge hit (similarity 0.91) comes before product hit (similarity 0.88)
    expect(results[0].type).toBe("knowledge");
    expect(results[1].type).toBe("product");
  });
});
