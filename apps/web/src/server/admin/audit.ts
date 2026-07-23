import prisma from "@/lib/prisma";

export async function logAudit(
  adminId: string | null,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId,
      action,
      resource,
      resourceId,
      metadata: (metadata || {}) as any,
    },
  });
}

export async function getAuditLogs(
  options: { limit?: number; offset?: number; action?: string; resource?: string; adminId?: string } = {}
) {
  const { limit = 50, offset = 0, action, resource, adminId } = options;

  const where: any = {};
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (adminId) where.adminId = adminId;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total };
}
