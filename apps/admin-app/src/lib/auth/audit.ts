import { prisma } from "@/lib/prisma";

export async function logAudit(
  adminId: string | null,
  action: string,
  module: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
  ip?: string,
  userAgent?: string
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId,
      action,
      module,
      targetId,
      metadata: (metadata || {}) as any,
      ip,
      userAgent,
    },
  });
}

export interface AuditQuery {
  limit?: number;
  offset?: number;
  action?: string;
  module?: string;
  adminId?: string;
}

export async function getAuditLogs(opts: AuditQuery = {}) {
  const { limit = 50, offset = 0, action, module, adminId } = opts;
  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (module) where.module = module;
  if (adminId) where.adminId = adminId;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as any,
      include: { admin: { select: { id: true, firstName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where: where as any }),
  ]);

  return { items, total };
}
