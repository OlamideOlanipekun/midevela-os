import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { assertPublicUrl } from "@/server/net/ssrfGuard";

const FETCH_TIMEOUT_MS = 6000;

/**
 * Checks whether the widget snippet is present on the merchant's site.
 * Server-side fetch (SSRF-guarded via assertPublicUrl) + a raw-HTML scan
 * for our script / the org's public key.
 *
 * HONEST LIMITATION (surfaced to the caller): a raw-HTML scan can't see a
 * script injected by a tag manager (GTM) or a fully client-rendered site —
 * the tag won't be in the initial HTML. So a negative result is reported as
 * "couldn't detect", never "it's broken", with guidance to eyeball the site.
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

    let url: URL;
    try {
      url = await assertPublicUrl(target); // throws ApiError(400) on private/invalid
    } catch {
      return NextResponse.json({
        installed: false,
        reachable: false,
        message: "That URL isn't a public web address we can reach. Check the spelling, or verify by opening your site yourself.",
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let html = "";
    let reachable = true;
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "MidevelaBot/1.0 (+https://midevela.com/bot)", Accept: "text/html" },
      });
      if (!res.ok) reachable = false;
      else html = await res.text();
    } catch {
      reachable = false;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!reachable) {
      return NextResponse.json({
        installed: false,
        reachable: false,
        message: "We couldn't load your site to check. It may be down, blocking bots, or not public yet — open it yourself to confirm the chat button appears.",
      });
    }

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
