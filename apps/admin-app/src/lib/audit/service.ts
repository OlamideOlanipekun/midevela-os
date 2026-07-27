import { prisma } from "@/lib/prisma";
import type { AuditLogItem, SecurityEventItem, AuditDashboard, ComplianceExportItem } from "./types";

export async function getAuditDashboard(): Promise<AuditDashboard> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [totalEvents, uniqueAdmins, topActions, topModules, eventsToday, securityEvents] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.groupBy({ by: ["adminId"], _count: true }),
    prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { _count: { action: "desc" } }, take: 10 }),
    prisma.auditLog.groupBy({ by: ["module"], _count: true, orderBy: { _count: { module: "desc" } }, take: 10 }),
    prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
    prisma.securityEvent.count(),
  ]);
  return {
    totalEvents, uniqueAdmins: uniqueAdmins.length,
    topActions: topActions.map((a) => ({ action: a.action, count: a._count })),
    topModules: topModules.map((m) => ({ module: m.module, count: m._count })),
    eventsToday, securityEvents,
  };
}

export async function listAuditLogs(params: {
  search?: string; action?: string; module?: string; adminId?: string;
  dateFrom?: string; dateTo?: string; page: number; limit: number;
}): Promise<{ items: AuditLogItem[]; total: number; page: number; totalPages: number }> {
  const { search, action, module, adminId, dateFrom, dateTo, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (action) AND.push({ action: { contains: action, mode: "insensitive" } });
  if (module) AND.push({ module: { contains: module, mode: "insensitive" } });
  if (adminId) AND.push({ adminId });
  if (search) {
    AND.push({
      OR: [
        { action: { contains: search, mode: "insensitive" } },
        { module: { contains: search, mode: "insensitive" } },
        { targetId: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) createdAt.lte = new Date(dateTo);
    AND.push({ createdAt });
  }
  const where = AND.length > 0 ? { AND } : {};

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit, include: { admin: { select: { firstName: true, lastName: true, email: true } } } }),
    prisma.auditLog.count({ where: where as any }),
  ]);
  return {
    items: items.map((a) => ({
      id: a.id, adminId: a.adminId, adminName: a.admin ? `${a.admin.firstName} ${a.admin.lastName || ""}`.trim() || a.admin.email : null,
      action: a.action, module: a.module, targetId: a.targetId, metadata: a.metadata as Record<string, unknown>,
      ip: a.ip, userAgent: a.userAgent, createdAt: a.createdAt.toISOString(),
    })),
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function listSecurityEvents(params: {
  type?: string; severity?: string; page: number; limit: number;
}): Promise<{ items: SecurityEventItem[]; total: number; page: number; totalPages: number }> {
  const { type, severity, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (type) AND.push({ type });
  if (severity) AND.push({ severity });
  const where = AND.length > 0 ? { AND } : {};

  const [items, total] = await Promise.all([
    prisma.securityEvent.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.securityEvent.count({ where: where as any }),
  ]);
  return {
    items: items.map((e) => ({ ...e, metadata: e.metadata as Record<string, unknown>, createdAt: e.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function getComplianceReport(type: string = "audit_log", dateFrom?: string, dateTo?: string) {
  const where: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) createdAt.lte = new Date(dateTo);
    where.createdAt = createdAt;
  }
  const events = await prisma.auditLog.findMany({ where: where as any, orderBy: { createdAt: "desc" }, take: 1000 });
  return { type, total: events.length, generatedAt: new Date().toISOString(), events: events.map((e) => ({ ...e, metadata: e.metadata as Record<string, unknown> })) };
}

export async function logSecurityEvent(data: { adminId?: string; orgId?: string; type: string; severity?: string; detail?: string; ip?: string; metadata?: Record<string, unknown> }) {
  return prisma.securityEvent.create({
    data: { adminId: data.adminId, orgId: data.orgId, type: data.type, severity: data.severity || "info", detail: data.detail, ip: data.ip, metadata: (data.metadata || {}) as any },
  });
}
