import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { safeFetch } from "@/server/website/crawler/fetcher";

const FETCH_TIMEOUT_MS = 6000;

/**
 * Checks whether the widget snippet is present on the merchant's site.
 * Server-side fetch (SSRF-guarded via safeFetch) + a raw-HTML scan
 * for our script / the org's public key.
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();

    const body = await req.json().catch(() => ({}));
    const rawUrl = String(body?.url ?? org.websiteUrl ?? "").trim();
    if (!rawUrl) {
      return jsonError(400, "No website URL to check. Add your site URL first.");
    }

    const key = await prisma.widgetKey.findFirst({
      where: { orgId: org.id, active: true },
      select: { publicKey: true },
    });

    let target = rawUrl;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    const fetchResult = await safeFetch(target, {
      timeoutMs: FETCH_TIMEOUT_MS,
      allowCrossHost: true,
      maxBytes: 2 * 1024 * 1024,
    });

    if (!("ok" in fetchResult) || !fetchResult.ok) {
      return NextResponse.json({
        installed: false,
        reachable: false,
        message: "We couldn't load your site to check. It may be down, blocking bots, or not a public address — open it yourself to confirm the chat button appears.",
      });
    }

    const html = fetchResult.html;
    const hasScript = /midevela-widget\.js/i.test(html);
    const hasKey = Boolean(key?.publicKey && html.includes(key.publicKey));
    const installed = hasScript || hasKey;

    return NextResponse.json({
      installed,
      reachable: true,
      message: installed
        ? "Your widget is installed and live on this page."
        : "We couldn't detect the widget in your page's HTML. If you installed it via a tag manager (e.g. Google Tag Manager) or your site is fully JavaScript-rendered, we may not see it here — open your site and look for the chat button to confirm.",
    });
  });
}

