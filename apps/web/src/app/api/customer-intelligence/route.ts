import { NextRequest, NextResponse } from "next/server";
import { customerIntelligence } from "@/server/customerIntelligence";

/**
 * Customer Intelligence Internal Service Boundary API (/customer-intelligence).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const sessionId = searchParams.get("sessionId");
    const customerId = searchParams.get("customerId") || undefined;
    const action = searchParams.get("action") || "getSessionState";

    if (!orgId || !sessionId) {
      return NextResponse.json({ error: "orgId and sessionId query params are required." }, { status: 400 });
    }

    if (action === "getReturningContext") {
      const returningContext = await customerIntelligence.getReturningContext(orgId, sessionId, customerId);
      return NextResponse.json({ success: true, returningContext });
    }

    if (action === "getSmartMemory") {
      const sessionState = await customerIntelligence.getSessionState(orgId, sessionId, customerId);
      const smartMemory = customerIntelligence.buildSmartMemory(sessionState);
      const promptFormatted = customerIntelligence.formatMemoryForPrompt(smartMemory);
      return NextResponse.json({ success: true, smartMemory, promptFormatted });
    }

    const sessionState = await customerIntelligence.getSessionState(orgId, sessionId, customerId);
    return NextResponse.json({ success: true, sessionState });
  } catch (err) {
    console.error("Customer Intelligence API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
