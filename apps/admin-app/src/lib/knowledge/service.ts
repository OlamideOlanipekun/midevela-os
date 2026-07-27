import { prisma } from "@/lib/prisma";
import type { DocumentItem, ChunkItem, MissingAnswerItem, SearchResult, KnowledgeAnalytics, KnowledgeHealth, DocumentDetail } from "./types";

export async function listDocuments(params: {
  orgId?: string; status?: string; type?: string; search?: string;
  page: number; limit: number;
}): Promise<{ items: DocumentItem[]; total: number; page: number; totalPages: number }> {
  const { orgId, status, type, search, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  const AND: Record<string, unknown>[] = [];
  if (orgId) AND.push({ orgId });
  if (status) AND.push({ status });
  if (type) AND.push({ type });
  if (search) AND.push({ title: { contains: search, mode: "insensitive" } });
  if (AND.length > 0) where.AND = AND;

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip, take: limit,
    }),
    prisma.document.count({ where: where as any }),
  ]);

  return {
    items: items.map((d) => ({ ...d, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(), fileSize: d.fileSize ?? undefined, pageCount: d.pageCount ?? undefined })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function getDocument(id: string): Promise<DocumentDetail | null> {
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { chunks: { orderBy: { index: "asc" } } },
  });
  if (!doc) return null;
  return { ...doc, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString(), fileSize: doc.fileSize ?? undefined, pageCount: doc.pageCount ?? undefined, chunks: doc.chunks.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })) } as any;
}

export async function listChunks(params: {
  documentId?: string; orgId?: string; search?: string;
  page: number; limit: number;
}): Promise<{ items: ChunkItem[]; total: number; page: number; totalPages: number }> {
  const { documentId, orgId, search, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  const AND: Record<string, unknown>[] = [];
  if (documentId) AND.push({ documentId });
  if (orgId) AND.push({ orgId });
  if (search) AND.push({ content: { contains: search, mode: "insensitive" } });
  if (AND.length > 0) where.AND = AND;

  const [items, total] = await Promise.all([
    prisma.knowledgeChunk.findMany({ where: where as any, orderBy: { index: "asc" }, skip, take: limit }),
    prisma.knowledgeChunk.count({ where: where as any }),
  ]);

  return {
    items: items.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function getChunk(id: string) {
  const chunk = await prisma.knowledgeChunk.findUnique({ where: { id }, include: { embedding: true } });
  if (!chunk) return null;
  return { ...chunk, createdAt: chunk.createdAt.toISOString() };
}

export async function listMissingAnswers(params: {
  orgId?: string; status?: string; page: number; limit: number;
}): Promise<{ items: MissingAnswerItem[]; total: number; page: number; totalPages: number }> {
  const { orgId, status, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (orgId) where.orgId = orgId;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.missingAnswer.findMany({ where: where as any, orderBy: [{ frequency: "desc" }, { createdAt: "desc" }], skip, take: limit }),
    prisma.missingAnswer.count({ where: where as any }),
  ]);

  return {
    items: items.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function resolveMissingAnswer(id: string, adminId: string) {
  return prisma.missingAnswer.update({
    where: { id },
    data: { status: "resolved", resolvedBy: adminId, resolvedAt: new Date() },
  });
}

export async function addMissingAnswer(data: { orgId: string; question: string; context?: string; conversationId?: string }) {
  const existing = await prisma.missingAnswer.findFirst({
    where: { orgId: data.orgId, question: { equals: data.question, mode: "insensitive" }, status: "open" },
  });
  if (existing) {
    return prisma.missingAnswer.update({ where: { id: existing.id }, data: { frequency: { increment: 1 } } });
  }
  return prisma.missingAnswer.create({ data: { orgId: data.orgId, question: data.question, context: data.context, conversationId: data.conversationId } });
}

export async function searchKnowledge(params: { orgId: string; query: string; limit?: number }): Promise<SearchResult[]> {
  const { orgId, limit = 10 } = params;
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      orgId,
      status: "ACTIVE",
      content: { contains: params.query, mode: "insensitive" },
    },
    take: limit,
    orderBy: { tokens: "desc" },
    include: { document: { select: { title: true, source: true } } },
  });

  return chunks.map((c, i) => ({
    chunkId: c.id,
    content: c.content.slice(0, 500),
    documentTitle: c.document.title,
    similarity: Math.max(0, 1 - (i * 0.1)),
    score: Math.max(0, 100 - (i * 10)),
    source: c.document.source,
  }));
}

export async function getKnowledgeAnalytics(orgId?: string): Promise<KnowledgeAnalytics> {
  const where = orgId ? { orgId } : {};
  const [totalDocuments, indexedDocuments, failedDocuments, totalChunks, totalTokens, missingAnswers, reindexQueue] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.count({ where: { ...where, status: "INDEXED" } as any }),
    prisma.document.count({ where: { ...where, status: "FAILED" } as any }),
    prisma.knowledgeChunk.count({ where }),
    prisma.knowledgeChunk.aggregate({ where, _sum: { tokens: true } }),
    prisma.missingAnswer.count({ where: { ...where, status: "open" } as any }),
    prisma.document.count({ where: { ...where, status: "PENDING" } as any }),
  ]);

  const total = totalTokens._sum.tokens || 0;
  const coverage = totalDocuments > 0 ? Math.round((indexedDocuments / totalDocuments) * 100) : 100;

  return { totalDocuments, indexedDocuments, failedDocuments, totalChunks, totalTokens: total, coverage, missingAnswers, reindexQueue };
}

export async function getKnowledgeHealth(): Promise<KnowledgeHealth> {
  const [totalDocuments, indexedDocuments, totalChunks, totalEmbeddings, missingAnswerCount, reindexQueue] = await Promise.all([
    prisma.document.count(),
    prisma.document.count({ where: { status: "INDEXED" } as any }),
    prisma.knowledgeChunk.count(),
    prisma.embedding.count(),
    prisma.missingAnswer.count({ where: { status: "open" } }),
    prisma.document.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } as any }),
  ]);

  const coverage = totalDocuments > 0 ? Math.round((indexedDocuments / totalDocuments) * 100) : 100;
  const healthScore = coverage;

  return {
    healthScore,
    totalDocuments, indexedDocuments, totalChunks, totalEmbeddings,
    coverage, missingAnswerCount,
    queueStatus: reindexQueue > 0 ? `${reindexQueue} pending` : "Healthy",
  };
}

export async function reindexDocument(documentId: string) {
  return prisma.document.update({ where: { id: documentId }, data: { status: "PENDING" } });
}

export async function reindexAll(orgId: string) {
  return prisma.document.updateMany({
    where: { orgId, status: { in: ["INDEXED", "FAILED"] } as any },
    data: { status: "PENDING" },
  });
}
