import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { listIntegrations, connectChannel } from "@/server/integrations/integrations";

export async function GET() {
  return withErrorHandling(async () => {
    const integrations = await listIntegrations();
    return NextResponse.json({ integrations });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { channel } = await req.json();
    if (!channel) {
      return NextResponse.json({ error: "channel is required" }, { status: 400 });
    }
    const integration = await connectChannel(channel);
    return NextResponse.json({ integration });
  });
}
