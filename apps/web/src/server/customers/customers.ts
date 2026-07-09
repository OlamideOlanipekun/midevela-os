import type { Customer, BuyingStage } from "@prisma/client";
import prisma from "@/lib/prisma";
import { relativeTime } from "@/server/shared/time";

const STAGE_LABELS: Record<BuyingStage, string> = {
  EXPLORING: "Exploring",
  COMPARING: "Comparing",
  PURCHASE_READY: "Purchase ready",
  PURCHASED: "Purchased",
};

const STAGE_BADGE_CLASS: Record<BuyingStage, string> = {
  EXPLORING: "badge-blue",
  COMPARING: "badge-gold",
  PURCHASE_READY: "badge-green",
  PURCHASED: "badge-green",
};

function displayName(c: Pick<Customer, "name" | "email" | "externalId" | "id">): string {
  if (c.name?.trim()) return c.name.trim();
  if (c.email?.trim()) return c.email.trim();
  const fallbackId = c.externalId?.trim() || c.id;
  return `Visitor ${fallbackId.slice(-6)}`;
}

type CustomerWithConversations = Customer & {
  conversations: { aiConfidence: number }[];
};

/**
 * `aiConfidence` reflects Conversation.aiConfidence, which the
 * conversation engine doesn't compute a real value for yet — it's the
 * schema default (100) on every row until that's wired up. Shown as-is
 * (real DB value) rather than invented, but it won't vary until the
 * engine actually starts writing a meaningful number there.
 *
 * `preferences` and product interests are genuinely empty for now —
 * nothing populates Customer.preferences or tracks product-view events
 * yet. Real absence, not a bug.
 */
export function toCustomerResponse(c: CustomerWithConversations) {
  const confidences = c.conversations.map((conv) => conv.aiConfidence);
  const avgConfidence = confidences.length
    ? Math.round(confidences.reduce((sum, v) => sum + v, 0) / confidences.length)
    : 100;

  return {
    id: c.id,
    name: displayName(c),
    email: c.email ?? "—",
    stage: STAGE_LABELS[c.buyingStage],
    stageClass: STAGE_BADGE_CLASS[c.buyingStage],
    conversations: c.conversations.length,
    lastSeen: relativeTime(c.lastSeen),
    aiConfidence: avgConfidence,
    preferences: Array.isArray(c.preferences) ? (c.preferences as string[]) : [],
    viewedProducts: [] as string[],
  };
}

export async function listCustomers(orgId: string) {
  const customers = await prisma.customer.findMany({
    where: { orgId },
    include: { conversations: { select: { aiConfidence: true } } },
    orderBy: { lastSeen: "desc" },
  });
  return customers.map(toCustomerResponse);
}
