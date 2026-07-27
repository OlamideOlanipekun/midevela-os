import { prisma } from "@/lib/prisma";
import type { ObservabilityDashboard } from "./types";

export async function getObservabilityDashboard(): Promise<ObservabilityDashboard> {
  const [totalFeedback, activeExperiments, recentSnapshots, recentFeedback] = await Promise.all([
    prisma.aIFeedback.count(),
    prisma.aIExperiment.count({ where: { active: true } }),
    prisma.aIMonitorSnapshot.findMany({ take: 10, orderBy: { snapshotAt: "desc" } }),
    prisma.aIFeedback.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
  ]);
  const avgAgg = await prisma.aIFeedback.aggregate({ _avg: { rating: true } });
  return {
    totalFeedback,
    avgRating: Math.round((avgAgg._avg.rating ?? 0) * 10) / 10,
    activeExperiments,
    recentSnapshots: recentSnapshots.map((s) => ({ ...s, cost: Number(s.cost), snapshotAt: s.snapshotAt.toISOString() })),
    recentFeedback: recentFeedback.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
  };
}

export async function listFeedback(opts: { rating?: number; category?: string; page: number; limit: number }) {
  const where: any = {};
  if (opts.rating) where.rating = opts.rating;
  if (opts.category) where.category = opts.category;
  const [items, total] = await Promise.all([
    prisma.aIFeedback.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit }),
    prisma.aIFeedback.count({ where }),
  ]);
  return { items: items.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })), total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) };
}

export async function listExperiments(activeOnly?: boolean) {
  const where = activeOnly ? { active: true } : {};
  return prisma.aIExperiment.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function listMonitorSnapshots(model?: string, hours?: number) {
  const where: any = {};
  if (model) where.model = model;
  if (hours) where.snapshotAt = { gte: new Date(Date.now() - hours * 3600000) };
  const items = await prisma.aIMonitorSnapshot.findMany({ where, orderBy: { snapshotAt: "desc" }, take: 100 });
  return items.map((s) => ({ ...s, cost: Number(s.cost), snapshotAt: s.snapshotAt.toISOString() }));
}
