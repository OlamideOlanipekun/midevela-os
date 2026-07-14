import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { getSubscriptionForOrg, accessLevelFor } from "@/server/billing/subscription";
import { compareProducts } from "@/server/widget/compare";
import { ApiError } from "@/server/http";

// Tighter than recommend/qualification — this can make an LLM call.
const COMPARE_IP_PER_MIN = 15;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const { widgetKey, productIds } = body ?? {};

    if (!widgetKey || typeof widgetKey !== "string") {
      return NextResponse.json({ error: "widgetKey is required." }, { status: 400, headers });
    }
    if (!Array.isArray(productIds) || productIds.length < 2) {
      return NextResponse.json({ error: "At least two productIds are required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`wcmp:ip:${clientIp(req.headers)}`, COMPARE_IP_PER_MIN, 60);
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

    // May call the LLM (sparse-attribute fallback) — same billing gate as chat.
    const subscription = await getSubscriptionForOrg(key.orgId);
    if (accessLevelFor(subscription.status) === "locked") {
      return NextResponse.json({ error: "Comparison unavailable right now." }, { status: 200, headers });
    }

    const result = await compareProducts(
      key.orgId,
      productIds.filter((id: unknown): id is string => typeof id === "string")
    );
    return NextResponse.json(result, { headers });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers });
    }
    console.error("Widget compare error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}
