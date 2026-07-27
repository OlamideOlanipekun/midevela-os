import type { Product, Category, KnowledgeEntry } from "@prisma/client";
import prisma from "@/lib/prisma";
import { embedText } from "@/server/conversation/embeddings";
import { formatMoney } from "@/server/catalog/money";
import { publishKnowledgeIndexed, publishKnowledgeFailed } from "@/server/events/instrument";

/**
 * MVP simplification: embedding writes happen inline on the request that
 * created/updated the row (adds Voyage's request latency to that write).
 * The architecture doc calls for this to move to a background job queue
 * (Inngest) once Phase 1's job infra exists — deliberately deferred, not
 * forgotten.
 *
 * One chunk per source for MVP (product: name+category+description;
 * knowledge: title+content) — chunkIndex is always 0. Writes to the
 * `embedding` column go through $executeRaw because Prisma can't write
 * Unsupported("vector(1024)") columns through its typed API.
 */

async function upsertEmbedding(params: {
  orgId: string;
  sourceType: "PRODUCT" | "KNOWLEDGE_ENTRY";
  sourceId: string;
  chunkText: string;
}) {
  const vector = await embedText(params.chunkText);
  // Validate every value is a finite number to guard against SQL injection via embedding service compromise
  if (!vector.every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new Error("Embedding service returned non-numeric values");
  }
  const vectorLiteral = `[${vector.join(",")}]`;

  await prisma.$executeRaw`
    INSERT INTO embeddings (id, org_id, source_type, source_id, chunk_index, chunk_text, embedding, created_at)
    VALUES (gen_random_uuid(), ${params.orgId}::uuid, ${params.sourceType}::"EmbeddingSourceType", ${params.sourceId}::uuid, 0, ${params.chunkText}, ${vectorLiteral}::vector, now())
    ON CONFLICT (source_type, source_id, chunk_index)
    DO UPDATE SET chunk_text = EXCLUDED.chunk_text, embedding = EXCLUDED.embedding, org_id = EXCLUDED.org_id
  `;
}

export async function syncProductEmbedding(
  orgId: string,
  product: Product & { category: Category | null }
) {
  const chunkText = [
    product.name,
    product.category?.name,
    formatMoney(product.price, product.currency),
    product.description,
  ]
    .filter(Boolean)
    .join(". ");

  await upsertEmbedding({ orgId, sourceType: "PRODUCT", sourceId: product.id, chunkText });
  publishKnowledgeIndexed(orgId, product.id, "PRODUCT", 1);
}

export async function syncKnowledgeEmbedding(orgId: string, entry: KnowledgeEntry) {
  const chunkText = `${entry.title}. ${entry.content}`;
  await upsertEmbedding({ orgId, sourceType: "KNOWLEDGE_ENTRY", sourceId: entry.id, chunkText });
  publishKnowledgeIndexed(orgId, entry.id, entry.type, 1);
}

export async function deleteEmbedding(
  sourceType: "PRODUCT" | "KNOWLEDGE_ENTRY",
  sourceId: string
) {
  await prisma.$executeRaw`
    DELETE FROM embeddings WHERE source_type = ${sourceType}::"EmbeddingSourceType" AND source_id = ${sourceId}::uuid
  `;
}
