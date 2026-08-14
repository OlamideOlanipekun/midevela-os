import prisma from "@/lib/prisma";
import { ShopperSessionState } from "./types";

export interface ReturningShopperContext {
  isReturning: boolean;
  lastSessionDate?: string;
  lastIntentSummary?: string;
  previouslyViewedProductIds: string[];
  previouslyComparedProductIds: string[];
  shortlistProductIds: string[];
  contextualGreeting: string;
}

export async function getReturningShopperContext(
  orgId: string,
  sessionId: string,
  customerId?: string | null
): Promise<ReturningShopperContext> {
  if (!customerId) {
    return {
      isReturning: false,
      previouslyViewedProductIds: [],
      previouslyComparedProductIds: [],
      shortlistProductIds: [],
      contextualGreeting: "Hello! How can I help you find what you're looking for today?",
    };
  }

  // Find previous session for this customer excluding current sessionId
  const pastSession = await prisma.shopperSession.findFirst({
    where: {
      orgId,
      customerId,
      sessionId: { not: sessionId },
    },
    orderBy: { lastActivityAt: "desc" },
  });

  if (!pastSession) {
    return {
      isReturning: false,
      previouslyViewedProductIds: [],
      previouslyComparedProductIds: [],
      shortlistProductIds: [],
      contextualGreeting: "Welcome back! What can I help you find today?",
    };
  }

  const productsViewed: string[] = Array.isArray(pastSession.productsViewed)
    ? (pastSession.productsViewed as string[])
    : [];
  const productsCompared: string[] = Array.isArray(pastSession.productsCompared)
    ? (pastSession.productsCompared as string[])
    : [];
  const shortlist: string[] = Array.isArray(pastSession.shortlist)
    ? (pastSession.shortlist as string[])
    : [];

  const intentStr = pastSession.currentIntent || "";
  let contextualGreeting = "Welcome back!";

  if (intentStr) {
    contextualGreeting = `Welcome back! Last time you were looking for ${intentStr}. Would you like to continue where you left off?`;
  } else if (shortlist.length > 0) {
    contextualGreeting = `Welcome back! You have ${shortlist.length} item(s) saved on your shortlist. Would you like to review them?`;
  } else if (productsViewed.length > 0) {
    contextualGreeting = `Welcome back! Would you like to take another look at the products you were browsing earlier?`;
  }

  return {
    isReturning: true,
    lastSessionDate: pastSession.lastActivityAt.toISOString(),
    lastIntentSummary: intentStr,
    previouslyViewedProductIds: productsViewed,
    previouslyComparedProductIds: productsCompared,
    shortlistProductIds: shortlist,
    contextualGreeting,
  };
}
