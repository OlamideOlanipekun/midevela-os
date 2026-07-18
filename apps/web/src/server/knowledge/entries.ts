import type { KnowledgeEntry } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { syncKnowledgeEmbedding, deleteEmbedding } from "@/server/knowledge/sync";
import { relativeTime } from "@/server/shared/time";
import { getPlanCaps, isUnlimited } from "@/server/billing/caps";

/** Throws a 403 once the org's total knowledge entries (FAQ + POLICY +
 *  DOCUMENT) are at its plan's cap. Call before creating a NEW row —
 *  updates to an existing entry never need this. */
async function assertKnowledgeBudget(orgId: string) {
  const { knowledgeCap } = await getPlanCaps(orgId);
  if (isUnlimited(knowledgeCap)) return;
  const count = await prisma.knowledgeEntry.count({ where: { orgId } });
  if (count >= knowledgeCap) {
    throw new ApiError(
      403,
      `You've reached your plan's knowledge base limit (${knowledgeCap} entries). Upgrade to add more.`
    );
  }
}

/** Best-effort — see products.ts's safeSyncProductEmbedding for why. */
async function safeSyncKnowledgeEmbedding(orgId: string, entry: KnowledgeEntry) {
  try {
    await syncKnowledgeEmbedding(orgId, entry);
  } catch (err) {
    console.error("Knowledge embedding sync failed:", err);
  }
}

async function safeDeleteEmbedding(id: string) {
  try {
    await deleteEmbedding("KNOWLEDGE_ENTRY", id);
  } catch (err) {
    console.error("Knowledge embedding delete failed:", err);
  }
}

interface FaqMetadata {
  category?: string;
  usageCount?: number;
}

interface DocumentMetadata {
  size?: string;
  chunks?: number;
  status?: string;
}

/**
 * COMPAT presenters — mirror the prototype's {faqs, policies, documents}
 * response. Rows now carry real ids (exposed) so the frontend can move
 * to id-based operations in Phase 1.
 */
function toFaq(e: KnowledgeEntry) {
  const meta = (e.metadata ?? {}) as FaqMetadata;
  return {
    id: e.id,
    question: e.title,
    answer: e.content,
    category: meta.category ?? "General",
    usageCount: meta.usageCount ?? 0,
  };
}

function toPolicy(e: KnowledgeEntry) {
  return {
    id: e.id,
    name: e.title,
    content: e.content,
    updatedAt: relativeTime(e.updatedAt),
  };
}

function toDocument(e: KnowledgeEntry) {
  const meta = (e.metadata ?? {}) as DocumentMetadata;
  return {
    id: e.id,
    name: e.title,
    size: meta.size ?? "—",
    chunks: meta.chunks ?? 0,
    status: meta.status ?? "Synced",
  };
}

export async function listKnowledge(orgId: string) {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });
  return {
    faqs: entries.filter((e) => e.type === "FAQ").map(toFaq),
    policies: entries.filter((e) => e.type === "POLICY").map(toPolicy),
    documents: entries.filter((e) => e.type === "DOCUMENT").map(toDocument),
  };
}

export async function createFaq(
  orgId: string,
  input: { question: string; answer: string; category?: string }
) {
  if (!input.question || !input.answer) {
    throw new ApiError(400, "Question and answer are required.");
  }
  await assertKnowledgeBudget(orgId);
  const entry = await prisma.knowledgeEntry.create({
    data: {
      orgId,
      type: "FAQ",
      title: input.question,
      content: input.answer,
      metadata: { category: input.category ?? "General", usageCount: 0 },
    },
  });
  await safeSyncKnowledgeEmbedding(orgId, entry);
  return toFaq(entry);
}

/** Upsert-by-name preserved from the prototype contract. */
export async function upsertPolicy(
  orgId: string,
  input: { name: string; content: string }
) {
  if (!input.name || !input.content) {
    throw new ApiError(400, "Policy name and content are required.");
  }
  const existing = await prisma.knowledgeEntry.findFirst({
    where: {
      orgId,
      type: "POLICY",
      title: { equals: input.name, mode: "insensitive" },
    },
  });
  if (!existing) await assertKnowledgeBudget(orgId);
  const entry = existing
    ? await prisma.knowledgeEntry.update({
        where: { id: existing.id },
        data: { title: input.name, content: input.content },
      })
    : await prisma.knowledgeEntry.create({
        data: { orgId, type: "POLICY", title: input.name, content: input.content },
      });
  await safeSyncKnowledgeEmbedding(orgId, entry);
  return toPolicy(entry);
}

/**
 * COMPAT: the current UI deletes FAQs by question text. Accepts an id or
 * a question string; id wins when both provided.
 */
export async function deleteFaq(
  orgId: string,
  ref: { id?: string; question?: string }
) {
  const entry = ref.id
    ? await prisma.knowledgeEntry.findFirst({
        where: { id: ref.id, orgId, type: "FAQ" },
      })
    : await prisma.knowledgeEntry.findFirst({
        where: { orgId, type: "FAQ", title: ref.question ?? "" },
      });
  if (!entry) throw new ApiError(404, "FAQ not found.");
  await prisma.knowledgeEntry.delete({ where: { id: entry.id } });
  await safeDeleteEmbedding(entry.id);
}
