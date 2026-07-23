import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { disconnectChannel } from "@/server/integrations/integrations";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { channel } = await req.json();
    if (!channel) {
      return NextResponse.json({ error: "channel is required" }, { status: 400 });
    }
    const integration = await disconnectChannel(channel);
    return NextResponse.json({ integration });
  });
}
