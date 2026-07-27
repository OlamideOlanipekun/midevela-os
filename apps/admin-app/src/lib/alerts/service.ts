import { prisma } from "@/lib/prisma";
import type { AlertItem, AlertRuleItem, AlertDashboard } from "./types";

export async function getAlertDashboard(): Promise<AlertDashboard> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [critical, warning, info, open, acknowledged, escalated, totalToday, byType] = await Promise.all([
    prisma.alert.count({ where: { severity: "CRITICAL", status: { not: "RESOLVED" } } }),
    prisma.alert.count({ where: { severity: "WARNING", status: { not: "RESOLVED" } } }),
    prisma.alert.count({ where: { severity: "INFO", status: { not: "RESOLVED" } } }),
    prisma.alert.count({ where: { status: "OPEN" } }),
    prisma.alert.count({ where: { status: "ACKNOWLEDGED" } }),
    prisma.alert.count({ where: { status: "ESCALATED" } }),
    prisma.alert.count({ where: { createdAt: { gte: today } } }),
    prisma.alert.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } }, take: 10 }),
  ]);
  return {
    critical, warning, info, open, acknowledged, escalated, totalToday,
    byType: byType.map((b) => ({ type: b.type, count: b._count })),
  };
}

export async function listAlerts(params: {
  severity?: string; status?: string; type?: string; orgId?: string;
  page: number; limit: number;
}): Promise<{ items: AlertItem[]; total: number; page: number; totalPages: number }> {
  const { severity, status, type, orgId, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (severity) AND.push({ severity });
  if (status) AND.push({ status });
  if (type) AND.push({ type });
  if (orgId) AND.push({ orgId });
  const where = AND.length > 0 ? { AND } : {};

  const [items, total] = await Promise.all([
    prisma.alert.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.alert.count({ where: where as any }),
  ]);
  return {
    items: items.map((a) => ({ ...a, metadata: a.metadata as Record<string, unknown>, acknowledgedAt: a.acknowledgedAt?.toISOString() || null, resolvedAt: a.resolvedAt?.toISOString() || null, createdAt: a.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function acknowledgeAlert(id: string, adminId: string) {
  return prisma.alert.update({ where: { id }, data: { status: "ACKNOWLEDGED", acknowledgedBy: adminId, acknowledgedAt: new Date() } });
}

export async function resolveAlert(id: string) {
  return prisma.alert.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
}

export async function listAlertRules(): Promise<AlertRuleItem[]> {
  const rules = await prisma.alertRule.findMany({ orderBy: { updatedAt: "desc" } });
  return rules.map((r) => ({ ...r, condition: r.condition as Record<string, unknown>, channels: r.channels as string[], createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })) as any;
}

export async function createAlertRule(data: { name: string; type: string; severity?: string; condition?: Record<string, unknown>; channels?: string[]; cooldown?: number; description?: string }) {
  return prisma.alertRule.create({
    data: { name: data.name, type: data.type, severity: (data.severity || "WARNING") as any, condition: (data.condition || {}) as any, channels: (data.channels || ["in_app"]) as any, cooldown: data.cooldown || 300, description: data.description },
  });
}

export async function updateAlertRule(id: string, data: { name?: string; active?: boolean; severity?: string; condition?: Record<string, unknown>; channels?: string[] }) {
  return prisma.alertRule.update({ where: { id }, data: data as any });
}

export async function deleteAlertRule(id: string) {
  return prisma.alertRule.delete({ where: { id } });
}

export async function getAlertStats() {
  const [total, open, avgResolution, bySeverity] = await Promise.all([
    prisma.alert.count(),
    prisma.alert.count({ where: { status: { notIn: ["RESOLVED"] } } }),
    prisma.alert.aggregate({ _count: true }),
    prisma.alert.groupBy({ by: ["severity"], _count: true }),
  ]);
  return { total, open, avgResolutionTime: 0, bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })) };
}
