import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";

export interface RetrievedProduct {
  type: "product";
  id: string;
  name: string;
  price: string;
  category: string | null;
  description: string | null;
  /** Merchant product page (sourceUrl), http(s) only. */
  url: string | null;
  /** First product image, http(s) only. */
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
function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

/** Product.images is loose JSON — entries may be "https://…" strings or
 *  objects like { url: "…" } depending on the import path. */
function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const entry of images) {
    const candidate =
      typeof entry === "string" ? entry : (entry as Record<string, unknown> | null)?.url;
    const url = safeHttpUrl(candidate);
    if (url) return url;
  }
  return null;
}

/**
 * Cosine-similarity search over the org's embeddings, then re-fetches the
 * *live* Product/KnowledgeEntry rows for any hits — never hands the model
 * stale chunk text for things like price or stock that change after the
 * chunk was embedded.
 */
export async function retrieveContext(
  orgId: string,
  queryEmbedding: number[],
  limit = 6
): Promise<RetrievedContext[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const hits = await prisma.$queryRaw<EmbeddingHit[]>`
    SELECT source_type, source_id, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM embeddings
    WHERE org_id = ${orgId}::uuid
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;

  const relevant = hits.filter((h) => h.similarity >= SIMILARITY_FLOOR);
  if (relevant.length === 0) return [];

  const productIds = relevant.filter((h) => h.source_type === "PRODUCT").map((h) => h.source_id);
  const knowledgeIds = relevant
    .filter((h) => h.source_type === "KNOWLEDGE_ENTRY")
    .map((h) => h.source_id);

  const [products, knowledgeEntries] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds }, orgId }, include: { category: true } })
      : Promise.resolve([]),
    knowledgeIds.length
      ? prisma.knowledgeEntry.findMany({ where: { id: { in: knowledgeIds }, orgId } })
      : Promise.resolve([]),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const knowledgeById = new Map(knowledgeEntries.map((k) => [k.id, k]));

  const results: RetrievedContext[] = [];
  for (const hit of relevant) {
    if (hit.source_type === "PRODUCT") {
      const p = productById.get(hit.source_id);
      // The product may have been deleted since it was embedded — skip
      // rather than surface a dangling reference.
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
    } else {
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
  }

  return results;
}
