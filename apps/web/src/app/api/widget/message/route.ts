import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveWidgetKey, isOriginAllowed } from "@/server/conversation/widgetAuth";
import { processConversationTurn } from "@/server/conversation/engine";
import { defaultOrgSettings, type OrgSettings } from "@/server/tenancy/org";
import type { ChatMessage } from "@/server/conversation/llm";

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_TURNS = 10;

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

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
    const { widgetKey, customerId, messageText } = body ?? {};

    if (!widgetKey || typeof widgetKey !== "string") {
      return NextResponse.json({ error: "widgetKey is required." }, { status: 400, headers });
    }
    if (!messageText || typeof messageText !== "string" || !messageText.trim()) {
      return NextResponse.json({ error: "messageText is required." }, { status: 400, headers });
    }
    if (messageText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400, headers });
    }

    const key = await resolveWidgetKey(widgetKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid widget key." }, { status: 401, headers });
    }
    if (!isOriginAllowed(key.allowedDomains, origin)) {
      return NextResponse.json({ error: "Origin not allowed for this widget key." }, { status: 403, headers });
    }

    const org = key.org;
    const externalId = typeof customerId === "string" && customerId.trim() ? customerId.trim() : "anonymous";

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

    const result = await processConversationTurn({
      orgId: org.id,
      orgName: org.name,
      settings,
      messageText,
      history,
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
