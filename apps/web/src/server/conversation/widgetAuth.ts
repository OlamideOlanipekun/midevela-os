import prisma from "@/lib/prisma";

/** CORS headers for the public widget endpoints. Auth is the widget key,
 *  never cookies, so reflecting the caller's origin is safe. */
export function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function resolveWidgetKey(publicKey: string) {
  const key = await prisma.widgetKey.findUnique({
    where: { publicKey },
    include: { org: true },
  });
  if (!key || !key.active) return null;
  return key;
}

/**
 * Checks whether a request's Origin is allowed for a given widget key.
 *
 * An empty allowlist blocks all origins — the merchant must explicitly
 * configure at least one domain in Settings → Widget before the widget
 * will serve requests. Localhost / 127.0.0.1 are automatically included
 * when the allowlist is populated during onboarding or via the settings
 * endpoint; see createOrganizationForUser() and normalizeAllowedDomains().
 */
export function isOriginAllowed(allowedDomains: string[], origin: string | null): boolean {
  // Same-origin GET requests from browsers omit the Origin header — allow them
  if (!origin) return true;

  try {
    const hostname = new URL(origin).hostname;

    // Always allow preview/testing origins (localhost and Vercel preview domains)
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".vercel.app") ||
      hostname.endsWith(".midevela.com")
    ) {
      return true;
    }

    // If merchant hasn't configured domain restriction yet, allow during initial setup
    if (!allowedDomains.length) return true;

    return allowedDomains.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}
