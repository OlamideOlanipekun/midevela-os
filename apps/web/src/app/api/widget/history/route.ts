import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import prisma from "@/lib/prisma";

const HISTORY_IP_PER_MIN = 30;
const MAX_MESSAGES = 50;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Returns the active conversation's recent messages for the given widget key
 * and customer identity. Never exposes data across organizations or customers.
 *
 * Called after widget boot to restore the visible transcript on a page reload
 * or navigation. Returns an empty messages array when the customer has no
 * active conversation, so the widget degrades gracefully to the welcome state.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const widgetKey = req.nextUrl.searchParams.get("key");
    const rawCustomerId = req.nextUrl.searchParams.get("customerId");

    if (!widgetKey || typeof widgetKey !== "string") {
      return NextResponse.json({ error: "key is required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`wh:ip:${clientIp(req.headers)}`, HISTORY_IP_PER_MIN, 60);
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429, headers });
    }

    const key = await resolveWidgetKey(widgetKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid widget key." }, { status: 401, headers });
    }
    if (!isOriginAllowed(key.allowedDomains, origin)) {
      return NextResponse.json({ error: "Origin not allowed for this widget key." }, { status: 403, headers });
    }

    const trimmedCustomerId =
      typeof rawCustomerId === "string" && rawCustomerId.trim().length <= 128
        ? rawCustomerId.trim()
        : "";
    if (!trimmedCustomerId) {
      return NextResponse.json({ conversationId: null, messages: [], context: null }, { headers });
    }

    const customer = await prisma.customer.findUnique({
      where: { orgId_externalId: { orgId: key.orgId, externalId: trimmedCustomerId } },
    });

    if (!customer) {
      return NextResponse.json({ conversationId: null, messages: [], context: null }, { headers });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { orgId: key.orgId, customerId: customer.id, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });

    if (!conversation) {
      return NextResponse.json({ conversationId: null, messages: [], context: null }, { headers });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: MAX_MESSAGES,
      select: {
        role: true,
        content: true,
        createdAt: true,
        recommendations: true,
      },
    });

    return NextResponse.json(
      {
        conversationId: conversation.id,
        context: conversation.context,
        messages: messages.map((m) => ({
          role: m.role === "AI" ? "assistant" : "user",
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          recommendations: m.recommendations as Array<{ id: string; name: string; price: string; whyThis: string; url: string | null; imageUrl: string | null }> | null,
        })),
      },
      { headers }
    );
  } catch (err) {
    console.error("Widget history error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}
