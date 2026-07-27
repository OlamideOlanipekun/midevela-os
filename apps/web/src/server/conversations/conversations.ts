import type { Conversation, Customer, Message } from "@prisma/client";
import prisma from "@/lib/prisma";
import { shortRelativeTime } from "@/server/shared/time";
import { STAGE_LABELS, STAGE_BADGE_CLASS, displayName } from "@/server/customers/presenter";

interface RecommendationJson {
  id?: string;
  name: string;
  price: string;
  whyThis: string;
}

function toMessageResponse(m: Message) {
  const recs = Array.isArray(m.recommendations)
    ? (m.recommendations as unknown as RecommendationJson[])
    : [];
  return {
    role: m.role === "CUSTOMER" ? ("customer" as const) : ("ai" as const),
    content: m.content,
    // ISO timestamp — the client formats it into a wall-clock time in
    // the viewer's own timezone rather than the server's.
    createdAt: m.createdAt.toISOString(),
    recommendations:
      recs.length > 0
        ? recs.map((r) => ({ name: r.name, price: r.price, why: r.whyThis }))
        : undefined,
  };
}

type ConversationWithRelations = Conversation & {
  customer: Customer;
  messages: Message[];
};

/**
 * `unread` has no real backing field yet — there's no read/unread
 * tracking on Conversation, so every conversation reports false rather
 * than inventing a signal. Same honesty as customers.ts for
 * aiConfidence/preferences/viewedProducts.
 */
function toConversationResponse(c: ConversationWithRelations) {
  const lastMessage = c.messages[c.messages.length - 1];
  return {
    id: c.id,
    name: displayName(c.customer),
    email: c.customer.email ?? "—",
    stage: STAGE_LABELS[c.customer.buyingStage],
    badgeClass: STAGE_BADGE_CLASS[c.customer.buyingStage],
    unread: false,
    time: shortRelativeTime(lastMessage?.createdAt ?? c.startedAt),
    preview: lastMessage?.content.slice(0, 140) ?? "",
    aiConfidence: c.aiConfidence,
    preferences: Array.isArray(c.customer.preferences) ? (c.customer.preferences as string[]) : [],
    viewedProducts: [] as string[],
    messages: c.messages.map(toMessageResponse),
  };
}

export async function listConversations(orgId: string, page = 1, limit = 50) {
  const conversations = await prisma.conversation.findMany({
    where: { orgId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
  return conversations.map(toConversationResponse);
}

export async function countConversations(orgId: string) {
  return prisma.conversation.count({ where: { orgId } });
}

const RECENT_CATEGORY_WINDOW_DAYS = 30;

/**
 * The category (if any) a returning visitor was shopping for recently —
 * sourced from Conversation.context, which sendMessage's contextPatch
 * already writes on every conversation's first message. No separate
 * tracking needed; this just reads what qualification already grounded
 * the AI with. Bounded to the last 30 days so a visitor from months ago
 * doesn't get a stale "welcome back" callback.
 */
export async function getRecentShoppingCategory(
  orgId: string,
  externalId: string
): Promise<{ id: string; name: string } | null> {
  const customer = await prisma.customer.findUnique({
    where: { orgId_externalId: { orgId, externalId } },
    select: { id: true },
  });
  if (!customer) return null;

  const since = new Date(Date.now() - RECENT_CATEGORY_WINDOW_DAYS * 86400000);
  const recent = await prisma.conversation.findMany({
    where: { orgId, customerId: customer.id, startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: { context: true },
  });

  for (const c of recent) {
    const ctx = c.context as Record<string, unknown>;
    if (ctx && typeof ctx.categoryId === "string" && typeof ctx.categoryName === "string") {
      return { id: ctx.categoryId, name: ctx.categoryName };
    }
  }
  return null;
}
