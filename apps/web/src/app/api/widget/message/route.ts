import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { processConversationTurn } from "@/server/conversation/engine";
import { defaultOrgSettings, type OrgSettings } from "@/server/tenancy/org";
import { publishConversationStarted, publishMessageSent, publishAIResponse, publishRecommendation, publishHumanHandoff } from "@/server/events/instrument";
import { eventBus } from "@/server/events/bus";
import { getSubscriptionForOrg, accessLevelFor } from "@/server/billing/subscription";
import { getUsageStatus, recordAiUsage } from "@/server/billing/usage";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import type { ChatMessage } from "@/server/conversation/llm";
import { tryAdaptiveDiscovery } from "@/server/widget/adaptiveDiscovery";
import { routeConversation } from "@/server/widget/intentRouter";
import type { RouteIntent } from "@/server/widget/intentRouter";
import { contextToState, stateToContext, resetShoppingState, mergeConstraints, addToShortlist, removeFromShortlist, keepInShortlist } from "@/server/widget/conversationState";
import type { ConversationState } from "@/server/widget/conversationState";
import { resolveProductReference } from "@/server/widget/referenceResolver";
import { getProductDetails } from "@/server/widget/productDetails";
import { compareProducts } from "@/server/widget/compare";
import { recommendProducts, type RecommendedProduct } from "@/server/widget/recommend";
import { listCategoriesForWidget } from "@/server/catalog/categories";
import { tryRecovery } from "@/server/widget/recoveryEngine";
import { directConversation } from "@/server/widget/conversationDirector";
import { answerBusinessQuestion } from "@/server/widget/businessBrain";
import { handleBrowse } from "@/server/widget/browseHandler";
import { escalate } from "@/server/widget/escalationEngine";
import { generatePaymentLink } from "@/server/widget/checkoutHandler";
import { resolvePageContext, buildContextHint } from "@/server/widget/contextResolver";
import { extractNavigationTarget, resolveNavigation } from "@/server/widget/navigationResolver";
// ── Milestone B imports ───────────────────────────────────────────────────────
import { classifyIntent, fastExtractConstraints } from "@/server/widget/intentEngine";
import { getSimilarProducts } from "@/server/widget/similarProducts";
import { checkVariantAvailability, listProductVariants } from "@/server/widget/variantEngine";
import { decideProducts } from "@/server/widget/decisionEngine";
import { explainRecommendations, summariseConstraints } from "@/server/widget/explain";
import { trackSearch, trackComparison, trackVariantCheck, trackDecisionSupport, trackFunnelEvent } from "@/server/analytics/funnel";

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_TURNS = 10;
// A "visit" is just the visitor's current ACTIVE conversation, bounded by
// this much inactivity. Past it, the visit is over: the conversation is
// ended and a fresh one starts, so a returning visitor's AI context can
// never be hijacked by an old, unrelated conversation. History is never
// deleted — the old conversation stays in the DB, just no longer active.
const VISIT_IDLE_MS = 30 * 60 * 1000;

// ─── Multi-layer usage control (workspace isolation + cost protection) ───
// Every layer below runs cheapest/broadest-first and BEFORE any DB write or
// LLM call, so an abusive or over-cap request never generates cost or data.
//
//   IP/key limits          → this specific widget key can't be hammered
//   Session limits         → one VISITOR can't hog the key's shared budget
//   Global platform limit  → protects Midevela's own Groq/Voyage spend
//                            across every merchant, independent of any
//                            single org's plan
//   Daily org safety limit → a runaway bot/loop can't burn a whole month
//                            of one merchant's cap in a single day
//   Monthly org cap        → the REAL per-plan limit (Plan.monthlyMessageCap),
//                            tracked durably in Postgres (server/billing/usage.ts)
const WIDGET_IP_PER_MIN = 60;
const WIDGET_KEY_PER_MIN = 30;
// Per-VISITOR-SESSION limits — tighter than the per-key limits above so one
// shopper can't monopolize a merchant's shared widget-key budget.
const SESSION_PER_MIN = 10;
const SESSION_MAX_MESSAGES = 30; // per session "lifetime" (approximated via a long window)
const SESSION_WINDOW_SEC = 6 * 60 * 60;
// Platform-wide safety net, independent of any org's plan — protects
// Midevela's own Groq/Voyage account from a runaway cost event.
const GLOBAL_MONTHLY_CAP = Number(process.env.GLOBAL_MONTHLY_MESSAGE_CAP) || 50000;

// Shown to a shopper when the merchant's subscription is inactive. The
// assistant simply goes quiet — we never spend Groq/Voyage on an org that
// isn't paying, but a shopper must never see a billing error.
const ASSISTANT_UNAVAILABLE_REPLY =
  "Thanks for your message! Our assistant is unavailable right now — please reach out to us directly and we'll be happy to help.";

// Shown when a shopper is sending messages too fast. A friendly nudge, not
// a raw 429 — the widget never surfaces an error to an end shopper.
const RATE_LIMITED_REPLY =
  "You're sending messages a little too quickly — please wait a moment and try again.";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Public endpoint embedded on merchant sites. Auth is the widget's public
 * key (resolved server-side to an org), never a client-supplied orgId —
 * see server/conversation/widgetAuth.ts.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const { widgetKey, customerId, messageText, context: contextPatch, currentUrl } = body ?? {};

    if (!widgetKey || typeof widgetKey !== "string") {
      return NextResponse.json({ error: "widgetKey is required." }, { status: 400, headers });
    }
    if (!messageText || typeof messageText !== "string" || !messageText.trim()) {
      return NextResponse.json({ error: "messageText is required." }, { status: 400, headers });
    }
    if (messageText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400, headers });
    }

    // Per-minute abuse limits, before any DB work. A tripped limit returns
    // a friendly nudge (200), not an error — the shopper just slows down,
    // and no LLM call is made.
    const ip = clientIp(req.headers);
    const [ipLimit, keyLimit] = await Promise.all([
      rateLimit(`wl:ip:${ip}`, WIDGET_IP_PER_MIN, 60),
      rateLimit(`wl:key:${widgetKey}`, WIDGET_KEY_PER_MIN, 60),
    ]);
    if (!ipLimit.ok || !keyLimit.ok) {
      return NextResponse.json(
        { replyText: RATE_LIMITED_REPLY, intent: null, recommendations: [] },
        { headers }
      );
    }

    // Platform-wide safety net — independent of any single org's plan or
    // widget key, protects Midevela's own Groq/Voyage account. Checked
    // before any DB read since it doesn't depend on which org this is.
    const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
    const globalLimit = await rateLimit(`usage:global:${yyyymm}`, GLOBAL_MONTHLY_CAP, 32 * 86400);
    if (!globalLimit.ok) {
      console.error(`Widget: PLATFORM-WIDE monthly message ceiling hit (${GLOBAL_MONTHLY_CAP}).`);
      return NextResponse.json(
        { replyText: ASSISTANT_UNAVAILABLE_REPLY, intent: null, recommendations: [] },
        { headers }
      );
    }

    const key = await resolveWidgetKey(widgetKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid widget key." }, { status: 401, headers });
    }
    if (!isOriginAllowed(key.allowedDomains, origin)) {
      return NextResponse.json({ error: "Origin not allowed for this widget key." }, { status: 403, headers });
    }

    const org = key.org;

    // Client-supplied visitor id, bounded. When absent (storage-blocked
    // browsers, scripted callers) mint a fresh one per request — a shared
    // "anonymous" bucket would merge strangers into one conversation and
    // leak their history to each other through the LLM context window.
    const trimmedCustomerId =
      typeof customerId === "string" && customerId.trim().length <= 128 ? customerId.trim() : "";
    const externalId = trimmedCustomerId || `anon-${crypto.randomUUID()}`;

    // Per-VISITOR-SESSION limits, scoped to this org so two different
    // merchants' visitors can never collide on the same key even if a
    // customerId were somehow reused. Tighter than the per-key limits above
    // so one shopper can't monopolize a merchant's shared widget-key budget.
    const sessionKey = `${org.id}:${externalId}`;
    const [sessionPerMin, sessionLifetime] = await Promise.all([
      rateLimit(`session:min:${sessionKey}`, SESSION_PER_MIN, 60),
      rateLimit(`session:total:${sessionKey}`, SESSION_MAX_MESSAGES, SESSION_WINDOW_SEC),
    ]);
    if (!sessionPerMin.ok || !sessionLifetime.ok) {
      return NextResponse.json(
        { replyText: RATE_LIMITED_REPLY, intent: null, recommendations: [] },
        { headers }
      );
    }

    // Billing gate: a locked (expired/cancelled) org's widget must not
    // reach the LLM. past_due stays live through the grace window — we
    // don't cut off a shopper mid-conversation over a late renewal.
    // Short-circuit *before* any customer/conversation/message writes so
    // an inactive org generates neither cost nor data.
    const subscription = await getSubscriptionForOrg(org.id);
    if (accessLevelFor(subscription.status) === "locked") {
      return NextResponse.json(
        { replyText: ASSISTANT_UNAVAILABLE_REPLY, intent: null, recommendations: [] },
        { headers }
      );
    }

    // Real per-plan usage: (a) a daily safety net sized to the org's own
    // plan (so a runaway bot/loop can't burn a whole month's cap in a day),
    // then (b) the actual monthly cap from Plan.monthlyMessageCap, tracked
    // durably in Postgres (server/billing/usage.ts) — this is the field
    // that existed in the schema but was never enforced anywhere before.
    const usage = await getUsageStatus(org.id);
    const dailyCap = usage.unlimited ? 2000 : Math.max(50, Math.ceil(usage.cap / 20));
    const dailyKey = `usage:daily:${org.id}:${new Date().toISOString().slice(0, 10)}`;
    const dailyLimit = await rateLimit(dailyKey, dailyCap, 86400);
    if (!dailyLimit.ok) {
      console.error(`Widget: org ${org.id} hit its daily safety limit (${dailyCap}).`);
      return NextResponse.json(
        { replyText: ASSISTANT_UNAVAILABLE_REPLY, intent: null, recommendations: [] },
        { headers }
      );
    }
    if (usage.level === "exceeded") {
      console.error(`Widget: org ${org.id} exceeded its ${usage.planCode} plan cap (${usage.used}/${usage.cap}).`);
      return NextResponse.json(
        { replyText: ASSISTANT_UNAVAILABLE_REPLY, intent: null, recommendations: [] },
        { headers }
      );
    }

    const customer = await prisma.customer.upsert({
      where: { orgId_externalId: { orgId: org.id, externalId } },
      update: { lastSeen: new Date() },
      create: { orgId: org.id, externalId, buyingStage: "EXPLORING" },
    });

    let conversation = await prisma.conversation.findFirst({
      where: { orgId: org.id, customerId: customer.id, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });

    let isNewConversation = false;

    if (conversation) {
      // Activity signal = the conversation's newest message, or its start
      // if it doesn't have one yet.
      const lastMessage = await prisma.message.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const lastActivity = lastMessage?.createdAt ?? conversation.startedAt;
      if (Date.now() - lastActivity.getTime() > VISIT_IDLE_MS) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: "ENDED", endedAt: new Date() },
        });
        conversation = null;
      }
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { orgId: org.id, customerId: customer.id, channel: "WEBSITE" },
      });
      isNewConversation = true;
      publishConversationStarted(conversation.id, org.id, org.name, customer.id, "WEBSITE");
    }

    // Shopping-funnel state (category/budget/brand/answers) collected via
    // the widget's Welcome→Category→Qualification steps. Merged in — never
    // replaced wholesale — so a later turn can't accidentally wipe earlier
    // context, and persisted immediately so a page refresh mid-conversation
    // doesn't lose it.
    const existingContext = (conversation.context ?? {}) as Record<string, unknown>;
    const mergedContext =
      contextPatch && typeof contextPatch === "object"
        ? { ...existingContext, ...(contextPatch as Record<string, unknown>) }
        : existingContext;
    if (contextPatch && typeof contextPatch === "object") {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { context: mergedContext as unknown as Prisma.InputJsonValue },
      });
    }

    const priorMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
    });
    const history: ChatMessage[] = priorMessages
      .slice()
      .reverse()
      .map((m) => ({ role: m.role === "AI" ? "assistant" : "user", content: m.content }));

    await prisma.message.create({
      data: { conversationId: conversation.id, role: "CUSTOMER", content: messageText },
    });
    publishMessageSent(conversation.id, org.id, "customer", 0, 0);

    // ── A3: Website Context Awareness ──────────────────────────────────────
    // Resolve the shopper's current page URL into structured context from the
    // Website Intelligence dataset. This anchors queries like "something cheaper"
    // to the real active product price and category from the DB.
    const pageContext = await resolvePageContext(
      org.id,
      typeof currentUrl === "string" ? currentUrl : null
    );
    const pageContextHint = buildContextHint(pageContext);

    // Derive ConversationState and saveResponse early — needed by the navigation
    // short-circuit below as well as all the downstream handlers.
    const state: ConversationState = contextToState(mergedContext);

    // Layout helper types used by the handlers below
    type ProductSummaryItem = { id: string; name: string };
    const recSummaries = (state.recommendedProducts ?? [])
      .map((id, i) => ({ id, name: `product-${i}` }));

    // Helper: save AI response + update conversation state + persist
    async function saveResponse(
      replyText: string,
      intent: string,
      recs: unknown[],
      newState: ConversationState,
    ) {
      const contextData = stateToContext(newState);
      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: conversation!.id,
            role: "AI",
            content: replyText,
            intent,
            recommendations: recs as unknown as Prisma.InputJsonValue,
          },
        }),
        prisma.conversation.update({
          where: { id: conversation!.id },
          data: { context: contextData as unknown as Prisma.InputJsonValue },
        }),
      ]);
      await recordAiUsage(org.id);
    }

    // ── A6: Navigation Intelligence — detect and short-circuit ─────────────
    // Check for navigation intent BEFORE any LLM call (zero cost).
    // Only returns URLs verified in the WebsitePage dataset.
    const navTarget = extractNavigationTarget(messageText);
    if (navTarget) {
      const navResult = await resolveNavigation(org.id, navTarget);
      if (navResult && navResult.confidence >= 0.6) {
        const replyText = navResult.replyText;
        await saveResponse(replyText, "navigation", [], { ...state });
        return NextResponse.json(
          {
            replyText,
            intent: "navigation",
            recommendations: [],
            isNewConversation,
            navigateTo: {
              url: navResult.targetUrl,
              title: navResult.targetTitle,
              pageType: navResult.pageType,
            },
          },
          { headers }
        );
      }
      // No verified URL found — fall through to general chat
    }

    const shoppingContextRaw = {
      // If the shopper is on a product page, seed the category from page context
      categoryName:
        typeof mergedContext.categoryName === "string"
          ? mergedContext.categoryName
          : pageContext.categoryName ?? undefined,
      // If the page is a product page and has a category, prioritise it
      categoryId:
        typeof mergedContext.categoryId === "string"
          ? mergedContext.categoryId
          : pageContext.categoryId ?? undefined,
      // Active product from page context — enables "something cheaper" grounding
      activeProductFromPage: pageContext.product ?? undefined,
      // Page context hint injected into the system prompt
      pageContextHint: pageContextHint ?? undefined,
      budget: typeof mergedContext.budget === "string" ? mergedContext.budget : undefined,
      brand: typeof mergedContext.brand === "string" ? mergedContext.brand : undefined,
      answers:
        mergedContext.answers && typeof mergedContext.answers === "object"
          ? (mergedContext.answers as Record<string, string>)
          : undefined,
    };

    // ──────── CONVERSATION MANAGER v1 ────────
    // Every message passes through the intent router before any LLM call.
    // The router classifies the message using pure pattern matching (no LLM
    // cost) and returns a RouteIntent. The state machine then dispatches to
    // the correct handler.
    //
    //   RouteIntent             → Handler
    //   ───────────               ───────
    //   PRODUCT_SELECTION       → resolve product → PRODUCT_DETAILS handler
    //   PRODUCT_DETAILS         → getProductDetails() from DB
    //   COMPARE                 → compareProducts() engine
    //   CHEAPER_ALTERNATIVE     → re-recommend with relaxed constraints
    //   NEW_SHOPPING_JOURNEY    → resetShoppingState() → adaptive discovery
    //   DISCOVERY               → tryAdaptiveDiscovery() or LLM
    //   GENERAL_CHAT            → processConversationTurn()
    //

    // ── 1. Conversation Director ──────────────────────────────────────
    // Every message goes through the Conversation Director before any
    // engine. The director decides the route based on Sales Memory and
    // patterns, then the dispatch block calls the appropriate handler.
    //
    //   Route               → Engine/Handler
    //   ────────────────      ─────────────────────────────────
    //   BUSINESS_SUPPORT    → answerBusinessQuestion()       (no LLM)
    //   BROWSE_CATEGORIES   → handleBrowse()                 (no LLM)
    //   CHECKOUT            → Checkout handler
    //   OBJECTION_HANDLING  → Cheaper alternative handler
    //   SHOPPING            → Intent-router dispatch
    //   GENERAL_CHAT        → processConversationTurn()      (LLM)
    //   ESCALATION          → escalate()                     (no LLM)
    //
    // ── B11: Merge page context into ConversationState ────────────────────
    // If the shopper is viewing a product page, pre-populate the active product
    // and category in state so follow-up queries automatically reference it.
    // Also store the page product/category in the dedicated activePageProduct
    // fields so "this" always resolves to what the shopper is looking at.
    const stateWithPageContext: ConversationState = {
      ...state,
      // Only override activeProductId if not already set by conversation state
      ...(pageContext.product && !state.activeProductId
        ? { activeProductId: pageContext.product.id }
        : {}),
      ...(pageContext.categoryId && !state.categoryId
        ? { categoryId: pageContext.categoryId, categoryName: pageContext.categoryName ?? state.categoryName }
        : {}),
      // B11: Always track the page product/category independently
      ...(pageContext.product ? { activePageProductId: pageContext.product.id } : {}),
      ...(pageContext.categoryId
        ? { activePageCategoryId: pageContext.categoryId, activePageCategoryName: pageContext.categoryName ?? state.activePageCategoryName }
        : {}),
    };

    const decision = directConversation(messageText, stateWithPageContext);
    const route = decision.routeResult;

    // Track the decision for Sales Memory
    let nextState: ConversationState = {
      ...stateWithPageContext,
      goal: decision.goal,
      nextBestAction: decision.nextBestAction,
    };

    // ── 2. Dispatch based on the director's decision ──────────────────

    // ── BUSINESS_SUPPORT ──────────────────────────────────────────────
    // Answers shipping, returns, hours, payment, contact questions from
    // KnowledgeEntry + OrgSettings — no LLM call.
    if (decision.route === "BUSINESS_SUPPORT") {
      const stored = (org.settings ?? {}) as Partial<OrgSettings>;
      const settings = { ...defaultOrgSettings, ...stored, name: org.name };
      const answer = await answerBusinessQuestion(messageText, settings, org.id);

      if (answer) {
        nextState = { ...nextState, mode: "GENERAL_CHAT", lastBusinessTopic: answer.topic };
        await saveResponse(answer.replyText, "business", [], nextState);
        return NextResponse.json(
          { replyText: answer.replyText, intent: "business", recommendations: [], isNewConversation },
          { headers },
        );
      }
      // Fall through to GENERAL_CHAT if no business answer found
    }

    // ── BROWSE_CATEGORIES ─────────────────────────────────────────────
    if (decision.route === "BROWSE_CATEGORIES") {
      const browseResult = await handleBrowse(org.id);
      nextState = { ...nextState, mode: "DISCOVERY" };
      await saveResponse(browseResult.replyText, "browse", [], nextState);
      return NextResponse.json(
        { replyText: browseResult.replyText, intent: "browse", recommendations: [], isNewConversation },
        { headers },
      );
    }

    // ── CHECKOUT ──────────────────────────────────────────────────────
    if (decision.route === "CHECKOUT" && state.activeProductId) {
      const linkResult = await generatePaymentLink({
        productId: state.activeProductId,
        orgId: org.id,
        customerEmail: customer.email ?? undefined,
      });

      if (linkResult) {
        if (linkResult.isPaystack) {
          const replyText = [
            `**${linkResult.productName}** — ${linkResult.productPrice}`,
            ``,
            `I've reserved this for you. Click the secure link below to complete your purchase:`,
            ``,
            `🔗 ${linkResult.paymentUrl}`,
            ``,
            `Would you like to continue shopping or do you need anything else?`,
          ].join("\n");
          nextState = { ...nextState, mode: "GENERAL_CHAT" };
          await saveResponse(replyText, "checkout", [], nextState);
          return NextResponse.json(
            { replyText, intent: "checkout", recommendations: [], isNewConversation },
            { headers },
          );
        }

        // Fallback: merchant's product page URL
        const replyText = [
          `**${linkResult.productName}** — ${linkResult.productPrice}`,
          ``,
          `You can view this product here:`,
          `→ ${linkResult.paymentUrl}`,
          ``,
          `Would you like to continue shopping or compare it with another product?`,
        ].join("\n");
        nextState = { ...nextState, mode: "GENERAL_CHAT" };
        await saveResponse(replyText, "checkout", [], nextState);
        return NextResponse.json(
          { replyText, intent: "checkout", recommendations: [], isNewConversation },
          { headers },
        );
      }

      // No link could be generated — simple acknowledgment
      const replyText = [
        `Great choice! Would you like to compare it with another product or see more options?`,
      ].join("\n");
      nextState = { ...nextState, mode: "GENERAL_CHAT" };
      await saveResponse(replyText, "checkout", [], nextState);
      return NextResponse.json(
        { replyText, intent: "checkout", recommendations: [], isNewConversation },
        { headers },
      );
    }

    // ── SHOPPING — Intent-router based dispatch ───────────────────────
    // All shopping intents go through the existing intent-router dispatch

    // ── PRODUCT_SELECTION ──────────────────────────────────────────────
    // Resolve "the first one", "the moisturizer", "number 2" to a product ID,
    // then show product details.
    if (route.intent === "PRODUCT_SELECTION" && state.recommendedProducts?.length) {
      // Fetch recommended product names for resolution
      const products = await prisma.product.findMany({
        where: { id: { in: state.recommendedProducts }, orgId: org.id },
        select: { id: true, name: true },
      });
      const summaries: ProductSummaryItem[] = state.recommendedProducts
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is ProductSummaryItem => Boolean(p));

      const resolved = resolveProductReference(messageText, summaries);

      if (resolved) {
        const otherNames = summaries
          .filter((p) => p.id !== resolved.productId)
          .map((p) => p.name);
        const details = await getProductDetails({ productId: resolved.productId, orgId: org.id, otherProductNames: otherNames });
        if (details) {
          const newState = {
            ...state,
            mode: "PRODUCT_DETAILS" as const,
            activeProductId: resolved.productId,
            waitingFor: details.nextAction === "offer_checkout" ? "checkout_confirmation" : undefined,
          };
          await saveResponse(details.replyText, "discovery", [], newState);
          return NextResponse.json(
            { replyText: details.replyText, intent: "discovery", recommendations: [], isNewConversation },
            { headers },
          );
        }
      }

      // Fall through: couldn't resolve — ask which product
      const names = summaries.map((p) => p.name).join(", ");
      const fallback = `Which product would you like to know more about? I have: ${names}`;
      await saveResponse(fallback, "unknown", [], { ...state, mode: "RECOMMENDATION" });
      return NextResponse.json(
        { replyText: fallback, intent: "unknown", recommendations: [], isNewConversation },
        { headers },
      );
    }

    // ── PRODUCT_DETAILS ────────────────────────────────────────────────
    // When the user asks about a product and we have an active one or can
    // resolve it.
    if (route.intent === "PRODUCT_DETAILS") {
      let targetId = state.activeProductId;

      // Try to resolve from the message if no active product
      if (!targetId && state.recommendedProducts?.length) {
        const products = await prisma.product.findMany({
          where: { id: { in: state.recommendedProducts }, orgId: org.id },
          select: { id: true, name: true },
        });
        const summaries: ProductSummaryItem[] = state.recommendedProducts
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is ProductSummaryItem => Boolean(p));

        const resolved = resolveProductReference(messageText, summaries);
        if (resolved) targetId = resolved.productId;
      }

      if (targetId) {
        // Resolve names for comparison suggestions
        const prodNames = state.recommendedProducts?.length
          ? await prisma.product.findMany({
              where: { id: { in: state.recommendedProducts }, orgId: org.id },
              select: { id: true, name: true },
            })
          : [];
        const otherNames = prodNames
          .filter((p) => p.id !== targetId)
          .map((p) => p.name);
        const details = await getProductDetails({ productId: targetId, orgId: org.id, otherProductNames: otherNames });
        if (details) {
          const newState: ConversationState = {
            ...state,
            mode: "PRODUCT_DETAILS",
            activeProductId: targetId,
            waitingFor: details.nextAction === "offer_checkout" ? "checkout_confirmation" : undefined,
          };
          await saveResponse(details.replyText, "discovery", [], newState);
          return NextResponse.json(
            { replyText: details.replyText, intent: "discovery", recommendations: [], isNewConversation },
            { headers },
          );
        }
      }

      // No active or resolvable product — try adaptive discovery as fallback
      // in case the message also contains a shopping intent.
    }

    // ── COMPARE ────────────────────────────────────────────────────────
    if (route.intent === "COMPARE" && (state.recommendedProducts?.length ?? 0) >= 2) {
      const shortlistIds = state.shortlistProductIds?.length
        ? state.shortlistProductIds.slice(0, 3)
        : state.recommendedProducts!.slice(0, 2);
      try {
        // B6: Pass shopper use case context for grounded recommendation
        const intentData = await classifyIntent(messageText, state);
        const compareResult = await compareProducts(org.id, shortlistIds, {
          shopperUseCase: intentData.decisionContext?.useCase ?? state.accumulatedConstraints?.useCase,
        });
        const rowsText = compareResult.rows
          .filter((r) => !r.allMissing)
          .map((r) => `• **${r.label}:** ${r.values.join(" vs ")}`)
          .join("\n");
        const productNames = compareResult.products.map((p) => `**${p.name}**`).join(" and ");
        const replyText = [
          `Here's how ${productNames} compare:`,
          ``,
          rowsText || "_(No additional specifications available from the store.)_",
          ``,
          compareResult.recommendation,
          ``,
          `Would you like to know more about either of these, or ask me which one I'd recommend?`,
        ].join("\n");

        const newState: ConversationState = {
          ...state,
          mode: "COMPARE",
          comparedProducts: shortlistIds,
        };
        await trackComparison({ orgId: org.id, customerId: customer.id, conversationId: conversation.id, productIds: shortlistIds });
        await saveResponse(replyText, "comparison", [], newState);
        return NextResponse.json(
          { replyText, intent: "comparison", recommendations: [], isNewConversation },
          { headers },
        );
      } catch {
        // Fall through to general chat on error
      }
    }

    // ── B7: DECISION_SUPPORT ──────────────────────────────────────────
    // Triggered by: "Which one should I choose?", "Which is better for office use?"
    {
      const intentData = await classifyIntent(messageText, state);
      if (intentData.intent === "DECISION_SUPPORT") {
        const candidateIds = (
          state.shortlistProductIds?.length
            ? state.shortlistProductIds
            : state.recommendedProducts ?? []
        ).slice(0, 3);

        if (candidateIds.length > 0) {
          const decisionResult = await decideProducts({
            orgId: org.id,
            productIds: candidateIds,
            question: messageText,
            context: {
              useCase: intentData.decisionContext?.useCase ?? state.accumulatedConstraints?.useCase,
              budget: state.budget,
              categoryName: state.categoryName ?? state.accumulatedConstraints?.categoryName,
              knownInformation: state.knownInformation,
            },
          });

          const replyText = [
            decisionResult.recommendation,
            decisionResult.reasoning ? `\n${decisionResult.reasoning}` : "",
            ``,
            `Would you like to know more about this product, or compare them further?`,
          ].filter(Boolean).join("\n");

          const newState: ConversationState = {
            ...state,
            mode: "COMPARE",
            goal: "DECISION",
            activeProductId: decisionResult.recommendedProductId ?? state.activeProductId,
          };
          await trackDecisionSupport({
            orgId: org.id,
            customerId: customer.id,
            conversationId: conversation.id,
            productIds: candidateIds,
            question: messageText,
            recommendedProductId: decisionResult.recommendedProductId,
          });
          await saveResponse(replyText, "decision", [], newState);
          return NextResponse.json(
            { replyText, intent: "decision", recommendations: [], isNewConversation },
            { headers },
          );
        }
      }

      // ── B10: VARIANT_CHECK ─────────────────────────────────────────────
      // "Do you have this in size 42?", "Is this available in black?"
      if (intentData.intent === "VARIANT_CHECK") {
        const targetProductId =
          state.activeProductId ??
          state.activePageProductId ??
          (state.shortlistProductIds?.[0]) ??
          (state.recommendedProducts?.[0]);

        if (targetProductId && intentData.variantQuery) {
          const variantResult = await checkVariantAvailability(
            org.id,
            targetProductId,
            intentData.variantQuery,
          );

          await trackVariantCheck({
            orgId: org.id,
            customerId: customer.id,
            conversationId: conversation.id,
            productId: targetProductId,
            variantQuery: {
              size: intentData.variantQuery.size,
              color: intentData.variantQuery.color,
            },
            found: variantResult.found,
          });

          const replyText = [
            variantResult.answer,
            ``,
            variantResult.found
              ? `Would you like to go to the product page or compare it with something else?`
              : `Can I help you find a different option?`,
          ].join("\n");

          await saveResponse(replyText, "variant_check", [], { ...state });
          return NextResponse.json(
            { replyText, intent: "variant_check", recommendations: [], isNewConversation },
            { headers },
          );
        }
      }

      // ── B5: SIMILARITY ────────────────────────────────────────────────
      // "Show me something similar", "More like this"
      if (intentData.intent === "SIMILARITY") {
        const refProductId =
          state.activeProductId ??
          state.activePageProductId ??
          (state.shortlistProductIds?.[0]) ??
          (state.recommendedProducts?.[0]);

        if (refProductId) {
          const similar = await getSimilarProducts(org.id, refProductId, { limit: 5 });

          if (similar.length > 0) {
            const lines = similar.map((p) => `**${p.name}** — ${p.price}`);
            const replyText = [
              `Here are similar products:`,
              ``,
              ...lines,
              ``,
              `Would you like to compare any of these or get more details?`,
            ].join("\n");

            const newState: ConversationState = {
              ...state,
              mode: "RECOMMENDATION",
              recommendedProducts: similar.map((p) => p.id),
            };
            await trackFunnelEvent("similar_request", { orgId: org.id, customerId: customer.id, conversationId: conversation.id });
            await saveResponse(replyText, "discovery", similar.map((p) => ({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, url: p.url, brand: p.brand, inStock: p.inStock })), newState);
            return NextResponse.json(
              { replyText, intent: "discovery", recommendations: similar, isNewConversation },
              { headers },
            );
          }
        }
      }

      // ── B4: CONSTRAINT_REFINEMENT — merge accumulated constraints ─────
      // "Something more casual", "Under ₦80k instead", "Actually, make it blue"
      if (intentData.intent === "CONSTRAINT_REFINEMENT" && state.categoryId) {
        const newConstraints = intentData.constraints;
        const merged = mergeConstraints(state.accumulatedConstraints, {
          categoryId: state.categoryId,
          categoryName: state.categoryName,
          maxPrice: newConstraints.maxPrice,
          minPrice: newConstraints.minPrice,
          color: newConstraints.color,
          style: newConstraints.style,
          brand: newConstraints.brand,
          useCase: newConstraints.useCase,
        });

        const newRecs = await recommendProducts({
          orgId: org.id,
          categoryId: state.categoryId,
          answers: state.budget ? { budget: `${state.budget.min ?? 0}-${state.budget.max ?? ""}` } : {},
          constraints: merged,
        });

        if (newRecs.length > 0) {
          const constraintSummary = summariseConstraints(merged);
          const lines = newRecs.map((p) => `**${p.name}** — ${p.price}`);
          const replyText = [
            constraintSummary
              ? `Here are refined results matching your preferences (${constraintSummary}):`
              : `Here are refined results:`,
            ``,
            ...lines,
            ``,
            `Would you like to compare any of these or narrow your search further?`,
          ].join("\n");

          const newState: ConversationState = {
            ...state,
            mode: "RECOMMENDATION",
            recommendedProducts: newRecs.map((p) => p.id),
            accumulatedConstraints: merged,
            shortlistProductIds: newRecs.map((p) => p.id),
          };
          await trackSearch({ orgId: org.id, customerId: customer.id, conversationId: conversation.id, query: messageText, resultCount: newRecs.length, constraints: merged });
          await saveResponse(replyText, "discovery", newRecs, newState);
          return NextResponse.json(
            { replyText, intent: "discovery", recommendations: newRecs, isNewConversation },
            { headers },
          );
        }
      }
    }

    // ── CHEAPER_ALTERNATIVE ────────────────────────────────────────────
    if (route.intent === "CHEAPER_ALTERNATIVE" && state.categoryId && state.recommendedProducts?.length) {
      const existingBudget = state.budget?.max;
      const products = await prisma.product.findMany({
        where: { id: { in: state.recommendedProducts }, orgId: org.id },
        select: { price: true },
      });
      const minPrice = products.length > 0
        ? Math.min(...products.map((p) => Number(p.price)))
        : 0;
      const newMax = Math.max(1000, Math.floor(minPrice * 0.7));

      const answers: Record<string, string> = {};
      if (state.categoryId) answers.budget = `0-${newMax}`;

      const newRecs = await recommendProducts({
        orgId: org.id,
        categoryId: state.categoryId,
        answers,
      });

      if (newRecs.length > 0) {
        const lines = newRecs.map((p) => `**${p.name}** — ${p.price}`);
        const replyText = lines.length === 1
          ? [`I found **${newRecs[0].name}** — ${newRecs[0].price}. Would you like to know more?`].join("\n")
          : [
              `Here are some more affordable options:`,
              ``,
              ...lines,
              ``,
              `Would you like more details on any of these?`,
            ].join("\n");

        const newState: ConversationState = {
          ...state,
          mode: "RECOMMENDATION",
          recommendedProducts: newRecs.map((p) => p.id),
          budget: { ...(state.budget ?? {}), max: newMax },
        };
        await saveResponse(replyText, "discovery", newRecs, newState);
        return NextResponse.json(
          { replyText, intent: "discovery", recommendations: newRecs, isNewConversation },
          { headers },
        );
      }

      // No cheaper products found
      const noResultsReply = [
        `I couldn't find any products under that price range in this category.`,
        ``,
        `Would you like to:`,
        `• Try a different category`,
        `• Adjust your budget`,
        `• See the original recommendations again`,
      ].join("\n");
      await saveResponse(noResultsReply, "unknown", [], { ...state, mode: "RECOMMENDATION" });
      return NextResponse.json(
        { replyText: noResultsReply, intent: "unknown", recommendations: [], isNewConversation },
        { headers },
      );
    }

    // ── NEW_SHOPPING_JOURNEY ───────────────────────────────────────────
    if (route.intent === "NEW_SHOPPING_JOURNEY") {
      const freshState = resetShoppingState(state);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { context: stateToContext(freshState) as unknown as Prisma.InputJsonValue },
      });
      // Fall through to adaptive discovery below with the fresh state
    }

    // ── DISCOVERY — try adaptive discovery ─────────────────────────────
    if (route.intent === "DISCOVERY" || route.intent === "NEW_SHOPPING_JOURNEY") {
      // B4: Extract constraints from the message and merge into accumulated state
      const localConstraints = fastExtractConstraints(messageText);
      const updatedConstraints = mergeConstraints(nextState.accumulatedConstraints, {
        ...(nextState.categoryId ? { categoryId: nextState.categoryId } : {}),
        ...(nextState.categoryName ? { categoryName: nextState.categoryName } : {}),
        maxPrice: localConstraints.maxPrice,
        minPrice: localConstraints.minPrice,
        color: localConstraints.color,
        style: localConstraints.style,
        useCase: localConstraints.useCase,
      });

      const result = await tryAdaptiveDiscovery(
        org.id,
        messageText,
        shoppingContextRaw.categoryName || shoppingContextRaw.budget || shoppingContextRaw.brand || shoppingContextRaw.answers
          ? shoppingContextRaw
          : null,
      );

      if (result) {
        const newMode = result.recommendations.length > 0
          ? ("RECOMMENDATION" as const)
          : result.fromEngine === false
            ? ("QUALIFICATION" as const)
            : ("DISCOVERY" as const);
        const newState: ConversationState = {
          ...state,
          mode: newMode,
          recommendedProducts: result.recommendations.map((p) => p.id),
          // B4: Persist accumulated constraints
          accumulatedConstraints: updatedConstraints,
          // B9: Seed shortlist from initial recommendations
          shortlistProductIds: result.recommendations.length > 0
            ? result.recommendations.map((p) => p.id)
            : nextState.shortlistProductIds,
          ...(result.shoppingContext.categoryName
            ? { categoryName: result.shoppingContext.categoryName }
            : {}),
          ...(result.shoppingContext.budget
            ? { budget: parseBudgetLabel(result.shoppingContext.budget) }
            : {}),
        };

        // B15: Track funnel event
        await trackSearch({
          orgId: org.id,
          customerId: customer.id,
          conversationId: conversation.id,
          query: messageText,
          resultCount: result.recommendations.length,
        });

        // Recovery: when adaptive discovery found no products and didn't
        // ask a follow-up question, try broadening the search.
        if (
          result.recommendations.length === 0 &&
          result.fromEngine !== false
        ) {
          const recovery = await tryRecovery({
            orgId: org.id,
            messageText,
            categoryId: newState.categoryId,
            categoryName: newState.categoryName,
            budget: newState.budget,
            answers: shoppingContextRaw.answers ?? {},
          });

          if (recovery) {
            newState.recommendedProducts = recovery.recommendations.map((p) => p.id);
            newState.mode = recovery.recommendations.length > 0
              ? "RECOMMENDATION"
              : "DISCOVERY";
            if (recovery.relaxedBudget) newState.budget = recovery.relaxedBudget;

            await saveResponse(recovery.replyText, "discovery", recovery.recommendations, newState);
            return NextResponse.json(
              {
                replyText: recovery.replyText,
                intent: "discovery",
                recommendations: recovery.recommendations,
                isNewConversation,
              },
              { headers },
            );
          }
        }

        await saveResponse(result.replyText, "discovery", result.recommendations, newState);
        return NextResponse.json(
          {
            replyText: result.replyText,
            intent: "discovery",
            recommendations: result.recommendations,
            isNewConversation,
          },
          { headers },
        );
      }
    }

    // ── ESCALATION — low-confidence handoff ──────────────────────────
    if (decision.route === "ESCALATION") {
      const stored = (org.settings ?? {}) as Partial<OrgSettings>;
      const settings = { ...defaultOrgSettings, ...stored, name: org.name };
      const result = escalate("low_confidence", settings);
      nextState = { ...nextState, mode: "GENERAL_CHAT" };
      await saveResponse(result.replyText, "escalation", [], nextState);
      return NextResponse.json(
        { replyText: result.replyText, intent: "escalation", recommendations: [], isNewConversation },
        { headers },
      );
    }

    // ── GENERAL_CHAT — normal LLM conversation ─────────────────────────
    // Also catches any PRODUCT_DETAILS or COMPARE that didn't resolve above.
    const stored = (org.settings ?? {}) as Partial<OrgSettings>;
    const settings = { ...defaultOrgSettings, ...stored };

    const llmResult = await processConversationTurn({
      orgId: org.id,
      orgName: org.name,
      settings,
      messageText,
      history,
      shoppingContext: shoppingContextRaw,
    });

    const llmMode: ConversationState["mode"] =
      llmResult.intent === "discovery" ? "DISCOVERY" : "GENERAL_CHAT";
    const newState: ConversationState = { ...state, mode: llmMode };
    await saveResponse(llmResult.replyText, llmResult.intent, llmResult.recommendations, newState);

    publishAIResponse(org.id, conversation.id, 0, llmResult.aiConfidence, llmResult.inputTokens + llmResult.outputTokens, llmResult.intent);
    publishMessageSent(conversation.id, org.id, "ai", llmResult.inputTokens, llmResult.outputTokens);

    for (const rec of llmResult.recommendations) {
      publishRecommendation(conversation.id, org.id, rec.id, rec.name);
    }

    return NextResponse.json(
      {
        replyText: llmResult.replyText,
        intent: llmResult.intent,
        recommendations: llmResult.recommendations,
        isNewConversation,
      },
      { headers },
    );
  } catch (err) {
    console.error("Widget message error:", err);
    return NextResponse.json(
      { error: "Something went wrong processing your message. Please try again." },
      { status: 500, headers }
    );
  }
}

/** Parse a budget label like "0-50000" or "10000-20000" into min/max numbers */
function parseBudgetLabel(label: unknown): { min?: number; max?: number } | undefined {
  if (typeof label !== "string") return undefined;
  const parts = label.split("-").map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const result: { min?: number; max?: number } = {};
  if (parts[0] > 0) result.min = parts[0];
  if (parts[1] > 0) result.max = parts[1];
  return result.min !== undefined || result.max !== undefined ? result : undefined;
}
