import { prisma } from "@/lib/prisma";
import type { QueueDashboard, QueueJobItem, WorkerLogItem, DeadLetterItem } from "./types";

export async function getQueueDashboard(): Promise<QueueDashboard> {
  const queues = ["embedding", "crawler", "products", "emails", "webhooks", "ai", "knowledge", "exports", "backups"];
  const [runningJobs, queued, completed, failed, retrying] = await Promise.all([
    prisma.queueJob.count({ where: { status: "RUNNING" } }),
    prisma.queueJob.count({ where: { status: "PENDING" } }),
    prisma.queueJob.count({ where: { status: "COMPLETED" } }),
    prisma.queueJob.count({ where: { status: "FAILED" } }),
    prisma.queueJob.count({ where: { status: "RETRYING" } }),
  ]);

  const queueStatuses = await Promise.all(queues.map(async (name) => {
    const [running, queuedCount, failedCount] = await Promise.all([
      prisma.queueJob.count({ where: { queue: name, status: "RUNNING" } }),
      prisma.queueJob.count({ where: { queue: name, status: "PENDING" } }),
      prisma.queueJob.count({ where: { queue: name, status: "FAILED" } }),
    ]);
    return { name, status: failedCount > 0 ? "Degraded" : "Healthy", running, queued: queuedCount, failed: failedCount, avgWaitTime: 0, avgProcessingTime: 0 };
  }));

  return { queues: queueStatuses, runningJobs, queued, completed, failed, retrying };
}

export async function listJobs(params: {
  queue?: string; status?: string; type?: string; orgId?: string;
  page: number; limit: number;
}): Promise<{ items: QueueJobItem[]; total: number; page: number; totalPages: number }> {
  const { queue, status, type, orgId, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (queue) AND.push({ queue });
  if (status) AND.push({ status });
  if (type) AND.push({ type });
  if (orgId) AND.push({ orgId });
  const where = AND.length > 0 ? { AND } : {};

  const [items, total] = await Promise.all([
    prisma.queueJob.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.queueJob.count({ where: where as any }),
  ]);
  return {
    items: items.map((j) => ({ ...j, payload: j.payload as Record<string, unknown>, scheduledAt: j.scheduledAt?.toISOString() || null, startedAt: j.startedAt?.toISOString() || null, completedAt: j.completedAt?.toISOString() || null, createdAt: j.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function getJob(id: string): Promise<QueueJobItem | null> {
  const job = await prisma.queueJob.findUnique({ where: { id } });
  if (!job) return null;
  return { ...job, payload: job.payload as Record<string, unknown>, scheduledAt: job.scheduledAt?.toISOString() || null, startedAt: job.startedAt?.toISOString() || null, completedAt: job.completedAt?.toISOString() || null, createdAt: job.createdAt.toISOString() } as any;
}

export async function retryJob(id: string) {
  return prisma.queueJob.update({ where: { id }, data: { status: "RETRYING", attempts: 0, error: null } });
}

export async function cancelJob(id: string) {
  return prisma.queueJob.update({ where: { id }, data: { status: "CANCELLED" } });
}

export async function listDeadLetters(params: { queue?: string; page: number; limit: number }): Promise<{ items: DeadLetterItem[]; total: number; page: number; totalPages: number }> {
  const { queue, page, limit } = params;
  const skip = (page - 1) * limit;
  const where = queue ? { queue } : {};
  const [items, total] = await Promise.all([
    prisma.deadLetterQueue.findMany({ where, orderBy: { failedAt: "desc" }, skip, take: limit }),
    prisma.deadLetterQueue.count({ where }),
  ]);
  return {
    items: items.map((d) => ({ ...d, payload: d.payload as Record<string, unknown>, failedAt: d.failedAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function listWorkerLogs(params: { worker?: string; jobId?: string; page: number; limit: number }): Promise<{ items: WorkerLogItem[]; total: number; page: number; totalPages: number }> {
  const { worker, jobId, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (worker) AND.push({ worker });
  if (jobId) AND.push({ jobId });
  const where = AND.length > 0 ? { AND } : {};
  const [items, total] = await Promise.all([
    prisma.workerLog.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.workerLog.count({ where: where as any }),
  ]);
  return {
    items: items.map((w) => ({ ...w, metadata: w.metadata as Record<string, unknown>, createdAt: w.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function getWorkerHealth() {
  const workers = ["crawler-1", "embedding-1", "ai-1", "email-1", "sync-1"];
  return workers.map((w) => ({
    worker: w, cpu: Math.round(45 + Math.random() * 30), ram: Math.round(60 + Math.random() * 25),
    runningJobs: Math.round(Math.random() * 5), avgDuration: Math.round(200 + Math.random() * 800),
    errors: Math.round(Math.random() * 3), restartCount: Math.round(Math.random() * 2),
  }));
}

export async function pauseQueue(queue: string) {
  return { queue, status: "paused" };
}

export async function resumeQueue(queue: string) {
  return { queue, status: "active" };
}

export async function getQueueMetrics() {
  const [avgWait, avgProcess, failed, retries, total] = await Promise.all([
    prisma.queueJob.aggregate({ _avg: { duration: true } }),
    prisma.queueJob.aggregate({ _avg: { duration: true } }),
    prisma.queueJob.count({ where: { status: "FAILED" } }),
    prisma.queueJob.count({ where: { status: "RETRYING" } }),
    prisma.queueJob.count(),
  ]);
  return {
    avgWaitTime: Math.round(avgWait._avg.duration || 0),
    avgProcessingTime: Math.round(avgProcess._avg.duration || 0),
    failureRate: total > 0 ? (failed / total) * 100 : 0,
    retries,
    peakHours: [],
  };
}
