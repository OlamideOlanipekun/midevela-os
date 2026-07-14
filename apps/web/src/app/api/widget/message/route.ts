import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { processConversationTurn } from "@/server/conversation/engine";
import { defaultOrgSettings, type OrgSettings } from "@/server/tenancy/org";
import { getSubscriptionForOrg, accessLevelFor } from "@/server/billing/subscription";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import type { ChatMessage } from "@/server/conversation/llm";

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_TURNS = 10;

// Per-minute abuse limits on the public widget. The key is public (it's in
// every merchant's page source), so these bound how fast anyone can drive
// paid LLM calls. Checked before the DB lookup so spam never touches Postgres.
const WIDGET_IP_PER_MIN = 60;
const WIDGET_KEY_PER_MIN = 30;
// Hard monthly ceiling on LLM turns per org — an abuse backstop independent
// of (and stricter-failing than) per-plan caps, which land in PR-8.
const WIDGET_MONTHLY_CAP = Number(process.env.WIDGET_MONTHLY_CAP) || 10000;

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

    const key = await resolveWidgetKey(widgetKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid widget key." }, { status: 401, headers });
    }
    if (!isOriginAllowed(key.allowedDomains, origin)) {
      return NextResponse.json({ error: "Origin not allowed for this widget key." }, { status: 403, headers });
    }

    const org = key.org;

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

    // Hard monthly ceiling on LLM turns for this org (abuse backstop). Keyed
    // by year-month so it rolls over automatically; checked before any writes
    // so an over-cap org generates neither cost nor data.
    const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
    const monthly = await rateLimit(`usage:${org.id}:${yyyymm}`, WIDGET_MONTHLY_CAP, 32 * 86400);
    if (!monthly.ok) {
      console.error(`Widget: org ${org.id} hit the monthly LLM ceiling (${WIDGET_MONTHLY_CAP}).`);
      return NextResponse.json(
        { replyText: ASSISTANT_UNAVAILABLE_REPLY, intent: null, recommendations: [] },
        { headers }
      );
    }

    // Client-supplied visitor id, bounded. When absent (storage-blocked
    // browsers, scripted callers) mint a fresh one per request — a shared
    // "anonymous" bucket would merge strangers into one conversation and
    // leak their history to each other through the LLM context window.
    const trimmedCustomerId =
      typeof customerId === "string" && customerId.trim().length <= 128 ? customerId.trim() : "";
    const externalId = trimmedCustomerId || `anon-${crypto.randomUUID()}`;

    const customer = await prisma.customer.upsert({
      where: { orgId_externalId: { orgId: org.id, externalId } },
      update: { lastSeen: new Date() },
      create: { orgId: org.id, externalId, buyingStage: "EXPLORING" },
    });

    let conversation = await prisma.conversation.findFirst({
      where: { orgId: org.id, customerId: customer.id, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { orgId: org.id, customerId: customer.id, channel: "WEBSITE" },
      });
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

    const result = await processConversationTurn({
      orgId: org.id,
      orgName: org.name,
      settings,
      messageText,
      history,
      shoppingContext,
    });

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "AI",
          content: result.replyText,
          intent: result.intent,
          recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { intent: result.intent },
      }),
    ]);

    return NextResponse.json(
      { replyText: result.replyText, intent: result.intent, recommendations: result.recommendations },
      { headers }
    );
  } catch (err) {
    console.error("Widget message error:", err);
    return NextResponse.json(
      { error: "Something went wrong processing your message. Please try again." },
      { status: 500, headers }
    );
  }
}
