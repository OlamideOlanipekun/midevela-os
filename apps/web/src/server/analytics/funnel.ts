/**
 * Shopping Funnel Analytics (Milestone B15)
 *
 * Tracks shopper events through the discovery → decision → purchase funnel.
 * All events are written to CustomerEvent records for merchant analytics.
 *
 * Events tracked:
 *   search              — shopper submitted a discovery query
 *   results_shown       — N products returned to shopper
 *   zero_results        — discovery returned 0 products
 *   product_click       — shopper selected / viewed a specific product
 *   comparison          — shopper initiated product comparison
 *   recommendation      — AI generated a recommendation
 *   recommendation_accepted — shopper took action after recommendation
 *   variant_check       — shopper asked about a specific variant
 *   query_refinement    — shopper refined an earlier search
 *   shortlist_update    — shopper added/removed from shortlist
 *   similar_request     — shopper asked for similar products
 *   decision_support    — shopper asked "which should I pick?"
 *   navigation          — shopper navigated to a product/category page
 *   add_to_cart         — shopper initiated checkout/cart
 */

import prisma from "@/lib/prisma";

// ── Event types ─────────────────────────────────────────────────────────────

export type FunnelEvent =
  | "search"
  | "results_shown"
  | "zero_results"
  | "product_click"
  | "comparison"
  | "recommendation"
  | "recommendation_accepted"
  | "variant_check"
  | "query_refinement"
  | "shortlist_update"
  | "similar_request"
  | "decision_support"
  | "navigation"
  | "add_to_cart";

export interface FunnelEventPayload {
  orgId: string;
  customerId: string;
  conversationId?: string;
  pageUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a funnel event for a shopper session.
 * Best-effort — a write failure never blocks the shopper's reply.
 */
export async function trackFunnelEvent(
  event: FunnelEvent,
  payload: FunnelEventPayload
): Promise<void> {
  try {
    await prisma.customerEvent.create({
      data: {
        orgId: payload.orgId,
        customerId: payload.customerId,
        eventType: event,
        pageUrl: payload.pageUrl ?? null,
        metadata: {
          ...(payload.conversationId ? { conversationId: payload.conversationId } : {}),
          ...(payload.metadata ?? {}),
        },
      },
    });
  } catch (err) {
    // Non-blocking — analytics failure must never break the shopping experience.
    console.error(`[Funnel] Failed to track event "${event}":`, err);
  }
}

/**
 * Helper: track a search with its outcome in one call.
 */
export async function trackSearch(
  payload: FunnelEventPayload & {
    query: string;
    resultCount: number;
    constraints?: Record<string, unknown> | object;
  }
): Promise<void> {
  const event: FunnelEvent = payload.resultCount === 0 ? "zero_results" : "search";
  await trackFunnelEvent(event, {
    ...payload,
    metadata: {
      query: payload.query,
      resultCount: payload.resultCount,
      ...(payload.constraints ? { constraints: payload.constraints } : {}),
      ...(payload.metadata ?? {}),
    },
  });

  if (payload.resultCount > 0) {
    await trackFunnelEvent("results_shown", {
      ...payload,
      metadata: { resultCount: payload.resultCount, query: payload.query },
    });
  }
}

/**
 * Helper: track a product comparison event.
 */
export async function trackComparison(
  payload: FunnelEventPayload & { productIds: string[] }
): Promise<void> {
  await trackFunnelEvent("comparison", {
    ...payload,
    metadata: { productIds: payload.productIds },
  });
}

/**
 * Helper: track a variant availability check.
 */
export async function trackVariantCheck(
  payload: FunnelEventPayload & {
    productId: string;
    variantQuery: Record<string, string | undefined>;
    found: boolean;
  }
): Promise<void> {
  await trackFunnelEvent("variant_check", {
    ...payload,
    metadata: {
      productId: payload.productId,
      variantQuery: payload.variantQuery,
      found: payload.found,
    },
  });
}

/**
 * Helper: track a decision support request.
 */
export async function trackDecisionSupport(
  payload: FunnelEventPayload & {
    productIds: string[];
    question: string;
    recommendedProductId?: string;
  }
): Promise<void> {
  await trackFunnelEvent("decision_support", {
    ...payload,
    metadata: {
      productIds: payload.productIds,
      question: payload.question,
      recommendedProductId: payload.recommendedProductId,
    },
  });
}

// ── Metric computation ───────────────────────────────────────────────────────

export interface FunnelMetrics {
  /** Searches that led to at least one product click */
  searchToClickRate: number;
  /** Searches that led to add_to_cart */
  searchToCartRate: number;
  /** Percentage of searches that returned 0 results */
  zeroResultRate: number;
  /** How often comparisons are used */
  comparisonRate: number;
  /** How often decision_support is used */
  decisionSupportRate: number;
  /** Average number of search events per conversation */
  avgQueryRefinements: number;
  /** Raw event counts */
  counts: Record<FunnelEvent, number>;
}

export async function computeFunnelMetrics(
  orgId: string,
  since?: Date
): Promise<FunnelMetrics> {
  const where = {
    orgId,
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const events = await prisma.customerEvent.groupBy({
    by: ["eventType"],
    where,
    _count: { eventType: true },
  });

  const counts = {} as Record<FunnelEvent, number>;
  for (const e of events) {
    counts[e.eventType as FunnelEvent] = e._count.eventType;
  }

  const searches = (counts.search ?? 0) + (counts.zero_results ?? 0);

  return {
    searchToClickRate: searches > 0 ? ((counts.product_click ?? 0) / searches) : 0,
    searchToCartRate: searches > 0 ? ((counts.add_to_cart ?? 0) / searches) : 0,
    zeroResultRate: searches > 0 ? ((counts.zero_results ?? 0) / searches) : 0,
    comparisonRate: searches > 0 ? ((counts.comparison ?? 0) / searches) : 0,
    decisionSupportRate: searches > 0 ? ((counts.decision_support ?? 0) / searches) : 0,
    avgQueryRefinements:
      searches > 0 ? ((counts.query_refinement ?? 0) / searches) : 0,
    counts,
  };
}
