import prisma from "@/lib/prisma";
import { syncKnowledgeEmbedding } from "@/server/knowledge/sync";
import { getPlanCaps, remainingBudget } from "@/server/billing/caps";
import type { ExtractedKnowledgeEntry } from "@/server/website/extraction/knowledge";

/**
 * Knowledge reconcile — persists crawled policies/FAQ/documents into
 * knowledge_entries under the same plan caps as manually added entries.
 *
 * Dedupe key: (orgId, type, titleHash) where titleHash is a sha256 of the
 * normalized title. A re-crawl of the same page updates content in place
 * instead of duplicating. Embeddings sync inline; a failed embed is
 * non-fatal.
 */

export interface KnowledgeReconcileResult {
  created: number;
  updated: number;
  unchanged: number;
  total: number;
}

import { createHash } from "crypto";

export function titleKey(type: string, title: string): string {
  return createHash("sha256")
    .update(`${type}::${title.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 40);
}

export async function reconcileKnowledge(
  orgId: string,
  entries: ExtractedKnowledgeEntry[]
): Promise<KnowledgeReconcileResult> {
  const result: KnowledgeReconcileResult = { created: 0, updated: 0, unchanged: 0, total: entries.length };
  if (entries.length === 0) return result;

  const { knowledgeCap } = await getPlanCaps(orgId);
  const existingCount = await prisma.knowledgeEntry.count({ where: { orgId } });
  let budget = remainingBudget(existingCount, knowledgeCap);
  const unlimited = budget === Infinity;

  // Pull existing keys once per crawl for fast lookups.
  const existingRows = await prisma.knowledgeEntry.findMany({
    where: { orgId },
    select: { id: true, type: true, title: true, content: true, metadata: true },
    take: 5000,
  });
  const byKey = new Map<string, { id: string; type: string; title: string; content: string; metadata: unknown }>();
  for (const row of existingRows) byKey.set(titleKey(row.type, row.title), row);

  for (const e of entries) {
    const key = titleKey(e.type, e.title);
    const existing = byKey.get(key);

    if (existing) {
      if (existing.content === e.content) {
        result.unchanged++;
        continue;
      }
      const updated = await prisma.knowledgeEntry.update({
        where: { id: existing.id },
        data: { content: e.content },
      });
      try {
        await syncKnowledgeEmbedding(orgId, updated);
      } catch (err) {
        console.error("[reconcile] knowledge embedding failed:", err);
      }
      result.updated++;
      continue;
    }

    if (!unlimited) {
      if (budget <= 0) continue;
      budget--;
    }

    const created = await prisma.knowledgeEntry.create({
      data: {
        orgId,
        type: e.type,
        title: e.title,
        content: e.content,
        metadata: { sourceUrl: e.sourceUrl },
      },
    });
    try {
      await syncKnowledgeEmbedding(orgId, created);
    } catch (err) {
      console.error("[reconcile] knowledge embedding failed:", err);
    }
    result.created++;
  }

  return result;
}