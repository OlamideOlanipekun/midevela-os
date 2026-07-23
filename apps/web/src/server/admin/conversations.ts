import prisma from "@/lib/prisma";

export async function listAdminConversations(options: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
  orgId?: string;
}) {
  const { limit = 50, offset = 0, status, search, orgId } = options;

  const where: any = {};
  if (status) where.status = status;
  if (orgId) where.orgId = orgId;
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
      { intent: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        org: { select: { id: true, name: true, slug: true } },
        messages: { take: 1, orderBy: { createdAt: "desc" }, select: { content: true, createdAt: true } },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.conversation.count({ where }),
  ]);

  return { items, total };
}

export async function getConversationDetail(id: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
      org: { select: { id: true, name: true, slug: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) return null;
  return conversation;
}
