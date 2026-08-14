import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";

export interface RetrievedProduct {
  type: "product";
  id: string;
  name: string;
  price: string;
  category: string | null;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  similarity: number;
}

export interface RetrievedKnowledge {
  type: "knowledge";
  id: string;
  title: string;
  content: string;
  similarity: number;
}

export type RetrievedContext = RetrievedProduct | RetrievedKnowledge;

interface EmbeddingHit {
  source_type: "PRODUCT" | "KNOWLEDGE_ENTRY";
  source_id: string;
  similarity: number;
}

const SIMILARITY_FLOOR = 0.5;

/** Only ever hand the widget an http(s) URL — these end up in href/src. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

/** Product.images is loose JSON — entries may be "https://…" strings or
 *  objects like { url: "…" } depending on the import path. */
export function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const entry of images) {
    const candidate =
      typeof entry === "string" ? entry : (entry as Record<string, unknown> | null)?.url;
    const url = safeHttpUrl(candidate);
    if (url) return url;
  }
  return null;
}

/** Ensure pgvector HNSW index exists for high-performance vector search */
export async function ensureHnswIndex(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "embeddings_embedding_hnsw_idx"
      ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
    `);
  } catch (err) {
    console.warn("[HNSW] Note: HNSW index creation check skipped:", err instanceof Error ? err.message : err);
  }
}

/**
 * PRODUCT INDEX RETRIEVAL
 * Queries pgvector HNSW vector index strictly for PRODUCT embeddings (source_type = 'PRODUCT'),
 * then hydrates live Product records.
 */
export async function retrieveProducts(
  orgId: string,
  queryEmbedding: number[],
  options?: { limit?: number; minSimilarity?: number }
): Promise<RetrievedProduct[]> {
  if (!queryEmbedding.every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new Error("Query embedding contains non-numeric values");
  }
  const limit = options?.limit ?? 6;
  const minSimilarity = options?.minSimilarity ?? SIMILARITY_FLOOR;
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const hits = await prisma.$queryRaw<EmbeddingHit[]>`
    SELECT source_type, source_id, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM embeddings
    WHERE org_id = ${orgId}::uuid AND source_type = 'PRODUCT'::"EmbeddingSourceType"
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;

  const relevant = hits.filter((h) => h.similarity >= minSimilarity);
  if (relevant.length === 0) return [];

  const productIds = relevant.map((h) => h.source_id);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, orgId },
    include: { category: true },
  });

  const productById = new Map(products.map((p) => [p.id, p]));
  const results: RetrievedProduct[] = [];

  for (const hit of relevant) {
    const p = productById.get(hit.source_id);
    if (!p) continue;
    results.push({
      type: "product",
      id: p.id,
      name: p.name,
      price: formatMoney(p.price, p.currency),
      category: p.category?.name ?? null,
      description: p.description,
      url: safeHttpUrl(p.sourceUrl),
      imageUrl: firstImageUrl(p.images),
      similarity: hit.similarity,
    });
  }

  return results;
}

/**
 * KNOWLEDGE INDEX RETRIEVAL
 * Queries pgvector HNSW vector index strictly for KNOWLEDGE_ENTRY embeddings (policies, FAQs, docs),
 * then hydrates live KnowledgeEntry records.
 */
export async function retrieveKnowledge(
  orgId: string,
  queryEmbedding: number[],
  options?: { limit?: number; minSimilarity?: number }
): Promise<RetrievedKnowledge[]> {
  if (!queryEmbedding.every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new Error("Query embedding contains non-numeric values");
  }
  const limit = options?.limit ?? 6;
  const minSimilarity = options?.minSimilarity ?? SIMILARITY_FLOOR;
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const hits = await prisma.$queryRaw<EmbeddingHit[]>`
    SELECT source_type, source_id, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM embeddings
    WHERE org_id = ${orgId}::uuid AND source_type = 'KNOWLEDGE_ENTRY'::"EmbeddingSourceType"
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;

  const relevant = hits.filter((h) => h.similarity >= minSimilarity);
  if (relevant.length === 0) return [];

  const knowledgeIds = relevant.map((h) => h.source_id);
  const knowledgeEntries = await prisma.knowledgeEntry.findMany({
    where: { id: { in: knowledgeIds }, orgId },
  });

  const knowledgeById = new Map(knowledgeEntries.map((k) => [k.id, k]));
  const results: RetrievedKnowledge[] = [];

  for (const hit of relevant) {
    const k = knowledgeById.get(hit.source_id);
    if (!k) continue;
    results.push({
      type: "knowledge",
      id: k.id,
      title: k.title,
      content: k.content,
      similarity: hit.similarity,
    });
  }

  return results;
}

/**
 * Clean facade combining separated product and knowledge index searches.
 */
export async function retrieveContext(
  orgId: string,
  queryEmbedding: number[],
  limit = 6
): Promise<RetrievedContext[]> {
  const [products, knowledge] = await Promise.all([
    retrieveProducts(orgId, queryEmbedding, { limit }),
    retrieveKnowledge(orgId, queryEmbedding, { limit }),
  ]);

  const combined: RetrievedContext[] = [...products, ...knowledge];
  return combined.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

