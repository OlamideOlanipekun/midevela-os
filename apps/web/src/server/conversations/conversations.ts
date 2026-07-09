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

export async function listConversations(orgId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { orgId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
  });
  return conversations.map(toConversationResponse);
}
