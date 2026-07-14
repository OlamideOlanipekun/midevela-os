import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { nextQualificationStep } from "@/server/widget/qualification";
import { ApiError } from "@/server/http";

const QUALIFICATION_IP_PER_MIN = 60;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Pure config walk over a category's qualificationFlow — no LLM, no
 * subscription gate needed (it's cheap and doesn't touch the model), but
 * still rate-limited since it's a public endpoint.
 */
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

    const ipLimit = await rateLimit(`wq:ip:${clientIp(req.headers)}`, QUALIFICATION_IP_PER_MIN, 60);
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

    const safeAnswers = answers && typeof answers === "object" ? (answers as Record<string, string>) : {};
    const result = await nextQualificationStep(key.orgId, categoryId, safeAnswers);
    return NextResponse.json(result, { headers });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers });
    }
    console.error("Widget qualification error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}
