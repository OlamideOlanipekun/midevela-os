export * from "./types";
export * from "./sessionManager";
export * from "./eventEngine";
export * from "./intentEvolution";
export * from "./preferenceLearner";
export * from "./behaviorScorer";
export * from "./journeyEngine";
export * from "./abandonmentIntelligence";
export * from "./personalizedRanker";
export * from "./returningShopper";
export * from "./conversationMemory";
export * from "./segmentation";
export * from "./privacyService";

import { getOrCreateShopperSession, updateShopperSession, linkSessionToCustomer } from "./sessionManager";
import { processCustomerEvent } from "./eventEngine";
import { analyzeAbandonmentJourney, generateContextualRecovery } from "./abandonmentIntelligence";
import { scoreAndRankProducts, recordOutcomeFeedback } from "./personalizedRanker";
import { getReturningShopperContext } from "./returningShopper";
import { buildSmartConversationMemory, formatSmartMemoryForPrompt } from "./conversationMemory";
import { recordExplicitPreference, recordBehavioralInteraction } from "./preferenceLearner";
import { executeRetentionPolicy } from "./privacyService";

export const customerIntelligence = {
  getSessionState: getOrCreateShopperSession,
  updateSessionState: updateShopperSession,
  linkSessionToCustomer,
  recordEvent: processCustomerEvent,
  analyzeAbandonment: analyzeAbandonmentJourney,
  getRecoveryPlan: generateContextualRecovery,
  rankProducts: scoreAndRankProducts,
  recordOutcome: recordOutcomeFeedback,
  getReturningContext: getReturningShopperContext,
  buildSmartMemory: buildSmartConversationMemory,
  formatMemoryForPrompt: formatSmartMemoryForPrompt,
  recordExplicitPreference,
  recordBehavioralInteraction,
  executeRetentionPolicy,
};
