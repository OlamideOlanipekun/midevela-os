import { NextRequest, NextResponse } from "next/server";
import { processConversationTurn } from "@/lib/ai/conversation";

// Called cross-origin from arbitrary merchant websites embedding the widget.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Endpoint receiving messages from the client-facing chat widget.
 * Processes intent and RAG retrieval matching, returning formatted responses.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, customerId, messageText, history } = body;

    if (!orgId || !messageText) {
      return NextResponse.json(
        { error: "orgId and messageText are required parameters." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call the turn execution orchestration logic
    const result = await processConversationTurn({
      orgId,
      customerId: customerId || "anonymous-shopper",
      messageText,
      history: history || [],
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Widget API Error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while processing message." },
      { status: 500, headers: corsHeaders }
    );
  }
}
