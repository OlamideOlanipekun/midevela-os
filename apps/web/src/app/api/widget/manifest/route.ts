import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";

/**
 * Dynamic Web App Manifest — Milestone A, A1 + A7
 *
 * Returns a valid W3C Web App Manifest for the merchant's Midevela PWA,
 * populated with the merchant's BrandTheme (name, colors, logo/icons).
 *
 * Usage:
 *   <link rel="manifest" href="/api/widget/manifest?key=<widgetKey>" />
 *
 * Because manifest.json must come from the same origin as the page that
 * installs the PWA, this route lives alongside the other widget API endpoints.
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  const widgetKey = req.nextUrl.searchParams.get("key");

  // Allow manifest fetch without a key → return a generic Midevela manifest
  // so the PWA is installable even before widget key is set.
  let businessName = "Midevela";
  let themeColor = "#6366f1";
  let backgroundColor = "#0a0f1e";
  let logoUrl: string | null = null;

  if (widgetKey) {
    const key = await resolveWidgetKey(widgetKey).catch(() => null);
    if (key) {
      if (!isOriginAllowed(key.allowedDomains, origin)) {
        // Allow manifest even without origin match (manifests are cross-origin fetched by browsers)
      }
      try {
        const { resolveThemeForOrg } = await import("@/server/branding/resolve");
        const theme = await resolveThemeForOrg(key.orgId);
        businessName = theme.businessName || key.org.name || "Midevela";
        themeColor = theme.primary || theme.header || "#6366f1";
        logoUrl = theme.logoUrl || null;
      } catch {
        // Fall through to defaults — manifest must always succeed
      }
    }
  }

  const shortName = businessName.length > 12
    ? businessName.slice(0, 12).trim() + "…"
    : businessName;

  const manifest = {
    name: `${businessName} — Powered by Midevela`,
    short_name: shortName,
    description: `Shop smarter with AI-powered recommendations from ${businessName}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: themeColor,
    background_color: backgroundColor,
    categories: ["shopping", "business"],
    lang: "en",
    icons: buildIconList(logoUrl),
    screenshots: [],
    related_applications: [],
    prefer_related_applications: false,
    shortcuts: [
      {
        name: "Chat with AI",
        short_name: "Chat",
        description: "Start a new shopping conversation",
        url: "/?open=chat",
        icons: [{ src: "/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      ...headers,
      "Content-Type": "application/manifest+json",
      // Manifest can be cached 5 minutes; stale while revalidate picks it up
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}

function buildIconList(logoUrl: string | null) {
  // Standard PWA icon sizes required for installability
  const standardSizes = [
    { size: "72x72", type: "image/png" },
    { size: "96x96", type: "image/png" },
    { size: "128x128", type: "image/png" },
    { size: "144x144", type: "image/png" },
    { size: "152x152", type: "image/png" },
    { size: "192x192", type: "image/png" },
    { size: "384x384", type: "image/png" },
    { size: "512x512", type: "image/png" },
  ];

  // If the merchant has a detected logo, use it for all icon sizes
  if (logoUrl) {
    return standardSizes.map(({ size, type }) => ({
      src: logoUrl,
      sizes: size,
      type,
      purpose: size === "192x192" || size === "512x512" ? "any maskable" : "any",
    }));
  }

  // Fall back to Midevela's own icons in /public
  return standardSizes.map(({ size, type }) => ({
    src: `/icon-${size.split("x")[0]}.png`,
    sizes: size,
    type,
    purpose: size === "192x192" || size === "512x512" ? "any maskable" : "any",
  }));
}
