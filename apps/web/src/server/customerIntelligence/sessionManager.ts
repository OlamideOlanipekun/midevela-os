import prisma from "@/lib/prisma";
import {
  ShopperSessionState,
  BehavioralScores,
  IntentConstraints,
  PageContext,
  JourneyState,
  IntentStage,
  CustomerSegment,
  ExplicitPreference,
  InferredPreference,
} from "./types";

const SESSION_TTL_DAYS = 30;

function defaultScores(): BehavioralScores {
  return {
    purchaseIntentScore: 0,
    cartIntentScore: 0,
    comparisonIntentScore: 0,
    productInterestScores: {},
    categoryInterestScores: {},
    brandInterestScores: {},
  };
}

function parseJsonField<T>(field: any, fallback: T): T {
  if (!field) return fallback;
  if (typeof field === "object") return field as T;
  try {
    return JSON.parse(String(field));
  } catch {
    return fallback;
  }
}

export async function getOrCreateShopperSession(
  orgId: string,
  sessionId: string,
  customerId?: string | null
): Promise<ShopperSessionState> {
  const existing = await prisma.shopperSession.findUnique({
    where: { sessionId },
  });

  if (existing) {
    // If customerId is provided now and session was missing customerId, link it
    let updatedCustomerId = existing.customerId;
    let isAnon = existing.isAnonymous;
    if (customerId && !existing.customerId) {
      updatedCustomerId = customerId;
      isAnon = false;
      await prisma.shopperSession.update({
        where: { id: existing.id },
        data: { customerId, isAnonymous: false },
      });
    }

    return {
      id: existing.id,
      orgId: existing.orgId,
      sessionId: existing.sessionId,
      customerId: updatedCustomerId,
      isAnonymous: isAnon,
      journeyState: (existing.journeyState as JourneyState) || "DISCOVERY",
      intentStage: (existing.intentStage as IntentStage) || "INITIAL",
      currentIntent: existing.currentIntent || "",
      intentConstraints: parseJsonField<IntentConstraints>(existing.intentConstraints, {}),
      scores: parseJsonField<BehavioralScores>(existing.scores, defaultScores()),
      explicitPreferences: parseJsonField<Record<string, ExplicitPreference>>(
        existing.explicitPreferences,
        {}
      ),
      inferredPreferences: parseJsonField<Record<string, InferredPreference>>(
        existing.inferredPreferences,
        {}
      ),
      categoriesViewed: parseJsonField<string[]>(existing.categoriesViewed, []),
      productsViewed: parseJsonField<string[]>(existing.productsViewed, []),
      productsCompared: parseJsonField<string[]>(existing.productsCompared, []),
      shortlist: parseJsonField<string[]>(existing.shortlist, []),
      pageContext: parseJsonField<PageContext>(existing.pageContext, {}),
      segment: (existing.segment as CustomerSegment) || "NEW_VISITOR",
      lastActivityAt: existing.lastActivityAt.toISOString(),
      createdAt: existing.createdAt.toISOString(),
      expiresAt: existing.expiresAt?.toISOString() ?? null,
    };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  const isAnonymous = !customerId;

  const created = await prisma.shopperSession.create({
    data: {
      orgId,
      sessionId,
      customerId: customerId || null,
      isAnonymous,
      journeyState: "DISCOVERY",
      intentStage: "INITIAL",
      currentIntent: "",
      intentConstraints: {},
      scores: defaultScores() as any,
      explicitPreferences: {},
      inferredPreferences: {},
      categoriesViewed: [],
      productsViewed: [],
      productsCompared: [],
      shortlist: [],
      pageContext: {},
      segment: isAnonymous ? "NEW_VISITOR" : "RETURNING_SHOPPER",
      expiresAt,
    },
  });

  return {
    id: created.id,
    orgId: created.orgId,
    sessionId: created.sessionId,
    customerId: created.customerId,
    isAnonymous: created.isAnonymous,
    journeyState: "DISCOVERY",
    intentStage: "INITIAL",
    currentIntent: "",
    intentConstraints: {},
    scores: defaultScores(),
    explicitPreferences: {},
    inferredPreferences: {},
    categoriesViewed: [],
    productsViewed: [],
    productsCompared: [],
    shortlist: [],
    pageContext: {},
    segment: isAnonymous ? "NEW_VISITOR" : "RETURNING_SHOPPER",
    lastActivityAt: created.lastActivityAt.toISOString(),
    createdAt: created.createdAt.toISOString(),
    expiresAt: created.expiresAt?.toISOString() ?? null,
  };
}

export async function updateShopperSession(
  orgId: string,
  sessionId: string,
  updates: Partial<ShopperSessionState>
): Promise<ShopperSessionState> {
  const current = await getOrCreateShopperSession(orgId, sessionId, updates.customerId);

  const dataToUpdate: any = {};

  if (updates.journeyState !== undefined) dataToUpdate.journeyState = updates.journeyState;
  if (updates.intentStage !== undefined) dataToUpdate.intentStage = updates.intentStage;
  if (updates.currentIntent !== undefined) dataToUpdate.currentIntent = updates.currentIntent;
  if (updates.intentConstraints !== undefined) dataToUpdate.intentConstraints = updates.intentConstraints;
  if (updates.scores !== undefined) dataToUpdate.scores = updates.scores;
  if (updates.explicitPreferences !== undefined) dataToUpdate.explicitPreferences = updates.explicitPreferences;
  if (updates.inferredPreferences !== undefined) dataToUpdate.inferredPreferences = updates.inferredPreferences;
  if (updates.categoriesViewed !== undefined) dataToUpdate.categoriesViewed = updates.categoriesViewed;
  if (updates.productsViewed !== undefined) dataToUpdate.productsViewed = updates.productsViewed;
  if (updates.productsCompared !== undefined) dataToUpdate.productsCompared = updates.productsCompared;
  if (updates.shortlist !== undefined) dataToUpdate.shortlist = updates.shortlist;
  if (updates.pageContext !== undefined) dataToUpdate.pageContext = updates.pageContext;
  if (updates.segment !== undefined) dataToUpdate.segment = updates.segment;
  if (updates.customerId !== undefined) {
    dataToUpdate.customerId = updates.customerId;
    dataToUpdate.isAnonymous = !updates.customerId;
  }

  const updated = await prisma.shopperSession.update({
    where: { sessionId },
    data: dataToUpdate,
  });

  return {
    id: updated.id,
    orgId: updated.orgId,
    sessionId: updated.sessionId,
    customerId: updated.customerId,
    isAnonymous: updated.isAnonymous,
    journeyState: (updated.journeyState as JourneyState) || "DISCOVERY",
    intentStage: (updated.intentStage as IntentStage) || "INITIAL",
    currentIntent: updated.currentIntent || "",
    intentConstraints: parseJsonField<IntentConstraints>(updated.intentConstraints, {}),
    scores: parseJsonField<BehavioralScores>(updated.scores, defaultScores()),
    explicitPreferences: parseJsonField<Record<string, ExplicitPreference>>(
      updated.explicitPreferences,
      {}
    ),
    inferredPreferences: parseJsonField<Record<string, InferredPreference>>(
      updated.inferredPreferences,
      {}
    ),
    categoriesViewed: parseJsonField<string[]>(updated.categoriesViewed, []),
    productsViewed: parseJsonField<string[]>(updated.productsViewed, []),
    productsCompared: parseJsonField<string[]>(updated.productsCompared, []),
    shortlist: parseJsonField<string[]>(updated.shortlist, []),
    pageContext: parseJsonField<PageContext>(updated.pageContext, {}),
    segment: (updated.segment as CustomerSegment) || "NEW_VISITOR",
    lastActivityAt: updated.lastActivityAt.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    expiresAt: updated.expiresAt?.toISOString() ?? null,
  };
}

export async function linkSessionToCustomer(
  orgId: string,
  sessionId: string,
  customerId: string
): Promise<ShopperSessionState> {
  return updateShopperSession(orgId, sessionId, {
    customerId,
    isAnonymous: false,
    segment: "RETURNING_SHOPPER",
  });
}
