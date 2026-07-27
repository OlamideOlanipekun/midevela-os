import { prisma } from "@/lib/prisma";
import type { SupportTicketItem, SupportMessageItem, SupportDashboard } from "./types";

function mapTicket(t: any): SupportTicketItem {
  return {
    id: t.id,
    orgId: t.orgId,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assignedTo,
    assigneeName: t.assignee ? `${t.assignee.firstName}${t.assignee.lastName ? " " + t.assignee.lastName : ""}` : null,
    createdBy: t.createdBy,
    creatorName: t.creator ? `${t.creator.firstName}${t.creator.lastName ? " " + t.creator.lastName : ""}` : null,
    messageCount: t._count?.messages ?? 0,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function getSupportDashboard(): Promise<SupportDashboard> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [open, inProgress, resolvedToday, critical, unassigned, oldTickets] = await Promise.all([
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.supportTicket.count({ where: { status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: todayStart } } }),
    prisma.supportTicket.count({ where: { priority: "CRITICAL", status: { notIn: ["CLOSED"] } } }),
    prisma.supportTicket.count({ where: { assignedTo: null, status: { notIn: ["CLOSED"] } } }),
    prisma.supportTicket.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      where: { status: { in: ["RESOLVED", "CLOSED"] } },
      select: { createdAt: true, updatedAt: true },
    }),
  ]);

  const avgMs = oldTickets.reduce((sum, t) => sum + (t.updatedAt.getTime() - t.createdAt.getTime()), 0);
  const avgResolutionHours = oldTickets.length > 0 ? Math.round(avgMs / oldTickets.length / 3600000) : 0;

  const [statusBreakdown, priorityBreakdown, recent] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ["status"], _count: true }),
    prisma.supportTicket.groupBy({ by: ["priority"], _count: true }),
    prisma.supportTicket.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { assignee: { select: { firstName: true, lastName: true } }, creator: { select: { firstName: true, lastName: true } }, _count: { select: { messages: true } } },
    }),
  ]);

  return {
    openTickets: open,
    inProgressTickets: inProgress,
    resolvedToday,
    criticalOpen: critical,
    unassignedTickets: unassigned,
    avgResolutionHours,
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count })),
    priorityBreakdown: priorityBreakdown.map((p) => ({ priority: p.priority, count: p._count })),
    recentTickets: recent.map(mapTicket),
  };
}

export async function listTickets(opts: { status?: string; priority?: string; assignedTo?: string; search?: string; page: number; limit: number }) {
  const where: any = {};
  if (opts.status) where.status = opts.status;
  if (opts.priority) where.priority = opts.priority;
  if (opts.assignedTo) where.assignedTo = opts.assignedTo;
  if (opts.search) where.OR = [{ subject: { contains: opts.search, mode: "insensitive" } }];

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: { assignee: { select: { firstName: true, lastName: true } }, creator: { select: { firstName: true, lastName: true } }, _count: { select: { messages: true } } },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { items: items.map(mapTicket), total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) };
}

export async function getTicket(id: string) {
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      creator: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { admin: { select: { firstName: true, lastName: true, avatar: true } } } },
      org: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!t) return null;
  return {
    ...mapTicket(t),
    orgName: t.org.name,
    orgSlug: t.org.slug,
    messages: t.messages.map((m) => ({
      id: m.id,
      ticketId: m.ticketId,
      adminId: m.adminId,
      authorName: m.authorName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      adminAvatar: m.admin?.avatar ?? null,
    })),
  };
}

export async function createTicket(data: { orgId: string; subject: string; priority?: string; createdBy?: string }) {
  const t = await prisma.supportTicket.create({
    data: {
      orgId: data.orgId,
      subject: data.subject,
      priority: (data.priority as any) ?? "NORMAL",
      createdBy: data.createdBy,
    },
    include: { assignee: { select: { firstName: true, lastName: true } }, creator: { select: { firstName: true, lastName: true } }, _count: { select: { messages: true } } },
  });
  return mapTicket(t);
}

export async function updateTicket(id: string, data: { status?: string; priority?: string; assignedTo?: string | null }) {
  const t = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status as any } : {}),
      ...(data.priority ? { priority: data.priority as any } : {}),
      ...(data.assignedTo !== undefined ? { assignedTo: data.assignedTo } : {}),
    },
    include: { assignee: { select: { firstName: true, lastName: true } }, creator: { select: { firstName: true, lastName: true } }, _count: { select: { messages: true } } },
  });
  return mapTicket(t);
}

export async function addMessage(ticketId: string, data: { adminId?: string; authorName: string; content: string }) {
  const m = await prisma.supportMessage.create({
    data: { ticketId, adminId: data.adminId, authorName: data.authorName, content: data.content },
  });
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
  return { id: m.id, ticketId: m.ticketId, adminId: m.adminId, authorName: m.authorName, content: m.content, createdAt: m.createdAt.toISOString() };
}

export async function listAdmins() {
  const admins = await prisma.admin.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, avatar: true },
    orderBy: { firstName: "asc" },
  });
  return admins.map((a) => ({ ...a, name: `${a.firstName}${a.lastName ? " " + a.lastName : ""}` }));
}
