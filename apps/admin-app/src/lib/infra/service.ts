import { prisma } from "@/lib/prisma";
import type { InfraDashboard, InfraMetricItem, DeploymentItem, ScheduledTaskItem } from "./types";

export async function getInfraDashboard(): Promise<InfraDashboard> {
  const [metricCount, deploymentCount, activeTasks, failedDeployments, latestMetrics, recentDeployments] = await Promise.all([
    prisma.infraMetric.count(),
    prisma.deployment.count(),
    prisma.scheduledTask.count({ where: { active: true } }),
    prisma.deployment.count({ where: { status: "FAILED" } }),
    prisma.infraMetric.findMany({ take: 10, orderBy: { recordedAt: "desc" } }),
    prisma.deployment.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    metricCount,
    deploymentCount,
    activeTasks,
    failedDeployments,
    latestMetrics: latestMetrics.map((m) => ({ ...m, recordedAt: m.recordedAt.toISOString() })),
    recentDeployments: recentDeployments.map((d) => ({ ...d, createdAt: d.createdAt.toISOString(), changelog: d.changelog })),
  };
}

export async function listMetrics(opts: { type?: string; hours?: number }) {
  const where: any = {};
  if (opts.type) where.type = opts.type;
  if (opts.hours) where.recordedAt = { gte: new Date(Date.now() - opts.hours * 3600000) };
  const items = await prisma.infraMetric.findMany({ where, orderBy: { recordedAt: "desc" }, take: 100 });
  return items.map((m) => ({ ...m, recordedAt: m.recordedAt.toISOString() }));
}

export async function listDeployments(opts: { service?: string; environment?: string; status?: string; page: number; limit: number }) {
  const where: any = {};
  if (opts.service) where.service = opts.service;
  if (opts.environment) where.environment = opts.environment;
  if (opts.status) where.status = opts.status;
  const [items, total] = await Promise.all([
    prisma.deployment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.limit, take: opts.limit }),
    prisma.deployment.count({ where }),
  ]);
  return {
    items: items.map((d) => ({ ...d, createdAt: d.createdAt.toISOString(), changelog: d.changelog })),
    total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit),
  };
}

export async function listScheduledTasks(type?: string) {
  const where = type ? { type } : {};
  const items = await prisma.scheduledTask.findMany({ where, orderBy: { name: "asc" } });
  return items.map((t) => ({ ...t, lastRunAt: t.lastRunAt?.toISOString() ?? null, nextRunAt: t.nextRunAt?.toISOString() ?? null }));
}
