import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { getSubscriptionForOrg, accessLevelFor } from "@/server/billing/subscription";
import { recommendProducts } from "@/server/widget/recommend";
import { ApiError } from "@/server/http";

const RECOMMEND_IP_PER_MIN = 30;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const { widgetKey, categoryId, answers } = body ?? {};

    if (!widgetKey || typeof widgetKey !== "string") {
      return NextResponse.json({ error: "widgetKey is required." }, { status: 400, headers });
    }
    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json({ error: "categoryId is required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`wr:ip:${clientIp(req.headers)}`, RECOMMEND_IP_PER_MIN, 60);
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

    // Uses Voyage embeddings — same billing gate as /widget/message so a
    // locked org doesn't keep generating cost.
    const subscription = await getSubscriptionForOrg(key.orgId);
    if (accessLevelFor(subscription.status) === "locked") {
      return NextResponse.json({ products: [] }, { headers });
    }

    const safeAnswers = answers && typeof answers === "object" ? (answers as Record<string, string>) : {};
    const products = await recommendProducts({ orgId: key.orgId, categoryId, answers: safeAnswers });
    return NextResponse.json({ products }, { headers });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers });
    }
    console.error("Widget recommend error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}
