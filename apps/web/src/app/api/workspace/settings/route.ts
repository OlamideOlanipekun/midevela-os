import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { toSettingsResponse, updateOrgSettings } from "@/server/tenancy/org";

/**
 * Normalize a caller-supplied allowed-domains list into bare hostnames.
 * Accepts either an array of strings or a newline/comma-separated string,
 * strips scheme/path/port, drops blanks, dedupes. An empty result means
 * the widget will only serve requests matching an explicitly configured
 * domain — the old permissive default (empty = all origins) was removed
 * for security. See isOriginAllowed().
 */
function normalizeAllowedDomains(input: unknown): string[] {
  const raw =
    Array.isArray(input) ? input.map(String)
    : typeof input === "string" ? input.split(/[\n,]/)
    : [];
  const hosts = new Set<string>();
  for (const item of raw) {
    let s = item.trim().toLowerCase();
    if (!s) continue;
    // Strip scheme + any path so "https://shop.com/x" -> "shop.com".
    try {
      s = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`).hostname;
    } catch {
      continue; // unparseable entry — skip rather than store junk
    }
    if (s) hosts.add(s);
  }
  return [...hosts];
}

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const widgetKey = await prisma.widgetKey.findFirst({
      where: { orgId: org.id, active: true },
      select: { publicKey: true, allowedDomains: true },
    });
    return NextResponse.json({
      settings: {
        ...toSettingsResponse(org),
        widgetPublicKey: widgetKey?.publicKey ?? null,
        allowedDomains: widgetKey?.allowedDomains ?? [],
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const body = await req.json();

    // Widget-key allowed-domains live on WidgetKey, not org.settings — handle
    // them separately when present, then hand the rest to updateOrgSettings.
    if (body && Object.prototype.hasOwnProperty.call(body, "allowedDomains")) {
      const domains = normalizeAllowedDomains(body.allowedDomains);
      await prisma.widgetKey.updateMany({
        where: { orgId: org.id, active: true },
        data: { allowedDomains: domains },
      });
    }

    const updated = await updateOrgSettings(org.id, body);
    const widgetKey = await prisma.widgetKey.findFirst({
      where: { orgId: org.id, active: true },
      select: { publicKey: true, allowedDomains: true },
    });
    return NextResponse.json({
      success: true,
      settings: {
        ...toSettingsResponse(updated),
        widgetPublicKey: widgetKey?.publicKey ?? null,
        allowedDomains: widgetKey?.allowedDomains ?? [],
      },
    });
  }, req);
}
