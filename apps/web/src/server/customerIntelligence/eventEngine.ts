import prisma from "@/lib/prisma";
import { getOrCreateShopperSession, updateShopperSession } from "./sessionManager";
import { updateScoresForEvent } from "./behaviorScorer";
import { evaluateJourneyState } from "./journeyEngine";
import { evolveIntent } from "./intentEvolution";
import { recordBehavioralInteraction } from "./preferenceLearner";
import { evaluateCustomerSegment } from "./segmentation";
import { BehavioralEventPayload, ShopperSessionState } from "./types";

export async function processCustomerEvent(payload: BehavioralEventPayload): Promise<ShopperSessionState> {
  const {
    orgId,
    sessionId,
    customerId,
    eventType,
    pageUrl,
    productId,
    categoryId,
    brand,
    searchQuery,
    filterConstraints,
    comparedProductIds,
    cartItemCount,
    cartTotalValue,
    metadata,
  } = payload;

  // 1. Fetch or create session state
  const session = await getOrCreateShopperSession(orgId, sessionId, customerId);

  // 2. Update behavioral scores
  const newScores = updateScoresForEvent(
    session.scores,
    eventType,
    productId,
    categoryId,
    brand,
    comparedProductIds
  );

  // 3. Update products viewed / compared / categories viewed lists
  const productsViewed = [...session.productsViewed];
  if (productId && !productsViewed.includes(productId)) {
    productsViewed.unshift(productId);
  }

  const categoriesViewed = [...session.categoriesViewed];
  if (categoryId && !categoriesViewed.includes(categoryId)) {
    categoriesViewed.unshift(categoryId);
  }

  const productsCompared = [...session.productsCompared];
  if (comparedProductIds && comparedProductIds.length > 0) {
    for (const pId of comparedProductIds) {
      if (!productsCompared.includes(pId)) {
        productsCompared.unshift(pId);
      }
    }
  }

  // 4. Update page context
  const pageContext = {
    ...session.pageContext,
    pageUrl: pageUrl || session.pageContext.pageUrl,
    activeProductId: productId || session.pageContext.activeProductId,
    activeCategoryId: categoryId || session.pageContext.activeCategoryId,
    searchQuery: searchQuery || session.pageContext.searchQuery,
  };

  // 5. Evaluate journey state
  const newJourneyState = evaluateJourneyState(session.journeyState, eventType, metadata);

  // 6. Evolve intent & constraints
  const { nextStage, updatedConstraints, intentSummary } = evolveIntent(
    session.intentStage,
    session.intentConstraints,
    filterConstraints || {},
    searchQuery
  );

  // 7. Update inferred preferences from behavioral interactions
  let updatedExplicit = session.explicitPreferences;
  let updatedInferred = session.inferredPreferences;

  if (brand) {
    const prefResult = recordBehavioralInteraction(updatedExplicit, updatedInferred, "brand", brand);
    updatedExplicit = prefResult.explicitPreferences;
    updatedInferred = prefResult.inferredPreferences;
  }

  if (categoryId) {
    const prefResult = recordBehavioralInteraction(updatedExplicit, updatedInferred, "category", categoryId);
    updatedExplicit = prefResult.explicitPreferences;
    updatedInferred = prefResult.inferredPreferences;
  }

  // 8. Determine customer segment
  const updatedStateForSegment: ShopperSessionState = {
    ...session,
    journeyState: newJourneyState,
    scores: newScores,
    intentConstraints: updatedConstraints,
    categoriesViewed,
    explicitPreferences: updatedExplicit,
    inferredPreferences: updatedInferred,
  };

  const newSegment = evaluateCustomerSegment(
    updatedStateForSegment,
    0,
    eventType === "CHECKOUT_ABANDONED"
  );

  // 9. Persist CustomerEvent record in database
  if (customerId) {
    await prisma.customerEvent.create({
      data: {
        orgId,
        customerId,
        eventType,
        pageUrl: pageUrl || null,
        metadata: metadata || {},
      },
    });
  }

  // 10. Persist updated ShopperSession state
  return updateShopperSession(orgId, sessionId, {
    scores: newScores,
    productsViewed,
    categoriesViewed,
    productsCompared,
    pageContext,
    journeyState: newJourneyState,
    intentStage: nextStage,
    currentIntent: intentSummary || session.currentIntent,
    intentConstraints: updatedConstraints,
    explicitPreferences: updatedExplicit,
    inferredPreferences: updatedInferred,
    segment: newSegment,
  });
}
