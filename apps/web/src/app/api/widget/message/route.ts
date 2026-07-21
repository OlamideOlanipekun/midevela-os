import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { processConversationTurn } from "@/server/conversation/engine";
import { defaultOrgSettings, type OrgSettings } from "@/server/tenancy/org";
import { getSubscriptionForOrg, accessLevelFor } from "@/server/billing/subscription";
import { getUsageStatus, recordAiUsage } from "@/server/billing/usage";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import type { ChatMessage } from "@/server/conversation/llm";
import { tryAdaptiveDiscovery } from "@/server/widget/adaptiveDiscovery";
import { classifyFollowUpIntent, handleFollowUp } from "@/server/widget/followUpHandler";
import type { RecommendedProduct } from "@/server/widget/recommend";
import { getInitialMode, modeForAdaptiveResult, modeForFollowUpType } from "@/server/widget/conversationModes";
import type { ConversationMode } from "@/server/widget/conversationModes";

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
    const { widgetKey, customerId, messageText, context: contextPatch } = body ?? {};

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

    const stored = (org.settings ?? {}) as Partial<OrgSettings>;
    const settings = { ...defaultOrgSettings, ...stored };

    const shoppingContext = {
      categoryName: typeof mergedContext.categoryName === "string" ? mergedContext.categoryName : undefined,
      budget: typeof mergedContext.budget === "string" ? mergedContext.budget : undefined,
      brand: typeof mergedContext.brand === "string" ? mergedContext.brand : undefined,
      answers:
        mergedContext.answers && typeof mergedContext.answers === "object"
          ? (mergedContext.answers as Record<string, string>)
          : undefined,
    };

    // Extract stored recommendations from context for RECOMMENDATION mode
    const storedRecs: RecommendedProduct[] = Array.isArray(mergedContext.lastRecommendations)
      ? (mergedContext.lastRecommendations as unknown as RecommendedProduct[])
      : [];

    // ──────── CONVERSATION STATE MACHINE ────────
    // Every message is routed based on the current conversation mode, which
    // is stored in conversation.context.mode. This prevents adaptive discovery
    // from re-entering after recommendations have already been shown.
    //
    //   DISCOVERY       → run adaptive discovery
    //   QUALIFICATION   → run adaptive discovery (still collecting info)
    //   RECOMMENDATION  → classify & handle follow-ups; only new_search or
    //                     unrelated fall through
    //   GENERAL_CHAT    → normal LLM conversation turn
    //
    const currentMode: ConversationMode =
      (typeof mergedContext.mode === "string" &&
        ["DISCOVERY", "QUALIFICATION", "RECOMMENDATION", "GENERAL_CHAT"].includes(mergedContext.mode as string))
        ? (mergedContext.mode as ConversationMode)
        : getInitialMode();

    // Helper: save AI response + update context mode + persist
    async function saveResponse(
      replyText: string,
      intent: string,
      recs: unknown[],
      newMode: ConversationMode,
      contextChanges?: Record<string, unknown>,
    ) {
      const updatedContext: Record<string, unknown> = {
        ...mergedContext,
        mode: newMode,
        ...(contextChanges ?? {}),
      };

      // Persist recommendations in context so RECOMMENDATION mode can use them
      // even after a page refresh.
      if (newMode === "RECOMMENDATION" && recs.length > 0) {
        updatedContext.lastRecommendations = recs;
      }

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
          data: { context: updatedContext as unknown as Prisma.InputJsonValue },
        }),
      ]);
    }

    // ── RECOMMENDATION mode: route follow-ups to dedicated handlers ──
    if (currentMode === "RECOMMENDATION") {
      const recs = storedRecs.length > 0 ? storedRecs : [];
      let handled = false;

      if (recs.length > 0) {
        const followUp = await classifyFollowUpIntent(messageText, recs);
        const nextMode = modeForFollowUpType(followUp?.type ?? null);

        if (followUp && nextMode === "RECOMMENDATION") {
          const result = await handleFollowUp(org.id, followUp, recs, shoppingContext);
          if (result) {
            await saveResponse(
              result.replyText,
              followUp.type === "compare" ? "comparison" : "discovery",
              result.recommendations,
              "RECOMMENDATION",
            );
            return NextResponse.json(
              { replyText: result.replyText, intent: "discovery", recommendations: result.recommendations, isNewConversation },
              { headers },
            );
          }
          handled = true;
        }

        if (followUp && nextMode === "DISCOVERY") {
          // User explicitly started a new search — transition to discovery
          await saveResponse("", "", [], "DISCOVERY", { lastRecommendations: null });
          // Fall through to adaptive discovery below with fresh mode
        }
      }

      if (!handled) {
        // Fall through to normal chat for unrelated messages in RECOMMENDATION mode
        const result = await processConversationTurn({
          orgId: org.id, orgName: org.name, settings, messageText, history, shoppingContext,
        });
        const newMode: ConversationMode = result.intent === "unknown" ? "RECOMMENDATION" : "GENERAL_CHAT";
        await saveResponse(result.replyText, result.intent, result.recommendations, newMode);
        await recordAiUsage(org.id);
        return NextResponse.json(
          { replyText: result.replyText, intent: result.intent, recommendations: result.recommendations, isNewConversation },
          { headers },
        );
      }
    }

    // ── DISCOVERY / QUALIFICATION / GENERAL_CHAT: adaptive discovery ──
    if (currentMode !== "GENERAL_CHAT") {
      const adaptiveResult = await tryAdaptiveDiscovery(
        org.id,
        messageText,
        shoppingContext.categoryName || shoppingContext.budget || shoppingContext.brand || shoppingContext.answers
          ? shoppingContext
          : null,
      );

      if (adaptiveResult) {
        const newMode = modeForAdaptiveResult(
          adaptiveResult.recommendations.length > 0,
          !adaptiveResult.fromEngine,
        );

        // Update shopping context in mergedContext with any newly extracted info
        const contextChanges: Record<string, unknown> = {};
        if (adaptiveResult.shoppingContext.categoryName) contextChanges.categoryName = adaptiveResult.shoppingContext.categoryName;
        if (adaptiveResult.shoppingContext.budget) contextChanges.budget = adaptiveResult.shoppingContext.budget;
        if (adaptiveResult.shoppingContext.brand) contextChanges.brand = adaptiveResult.shoppingContext.brand;
        if (adaptiveResult.shoppingContext.answers) contextChanges.answers = adaptiveResult.shoppingContext.answers;

        await saveResponse(
          adaptiveResult.replyText,
          adaptiveResult.recommendations.length > 0 ? "discovery" : "unknown",
          adaptiveResult.recommendations,
          newMode,
          contextChanges,
        );

        return NextResponse.json(
          {
            replyText: adaptiveResult.replyText,
            intent: adaptiveResult.recommendations.length > 0 ? "discovery" : "unknown",
            recommendations: adaptiveResult.recommendations,
            isNewConversation,
          },
          { headers },
        );
      }
    }

    // ── Fall through to normal LLM conversation ──
    const result = await processConversationTurn({
      orgId: org.id, orgName: org.name, settings, messageText, history, shoppingContext,
    });

    const nextMode: ConversationMode = result.intent === "discovery" ? "DISCOVERY" : "GENERAL_CHAT";
    await saveResponse(result.replyText, result.intent, result.recommendations, nextMode);
    await recordAiUsage(org.id);

    return NextResponse.json(
      {
        replyText: result.replyText,
        intent: result.intent,
        recommendations: result.recommendations,
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
