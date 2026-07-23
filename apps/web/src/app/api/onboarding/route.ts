import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import {
  createOrganizationForUser,
  updateOrgSettings,
} from "@/server/tenancy/org";
import { publishMerchantCreated, publishWidgetInstalled, publishWebsiteConnected } from "@/server/events/instrument";
import { connectWebsite } from "@/server/website/service";

function embedSnippet(appOrigin: string, publicKey: string) {
  return [
    "<!-- Midevela AI Assistant -->",
    `<script src="${appOrigin}/widget/midevela-widget.js" data-widget-key="${publicKey}" async></script>`,
  ].join("\n");
}

/**
 * Completes onboarding: creates the organization, links the user as
 * OWNER, issues the widget key. Idempotent — a user with an org gets
 * their existing org + key back (settings still updated).
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    const body = await req.json();
    const {
      businessName,
      website,
      industry,
      country,
      aiName,
      tone,
      greeting,
      neverSay,
      channels,
      accentColor,
      engagementDelay,
      whatsappNumber,
      sellsDescription,
      businessHours,
      currency,
    } = body ?? {};

    const settings = {
      ...(aiName !== undefined ? { aiName } : {}),
      ...(tone !== undefined ? { tone } : {}),
      ...(greeting !== undefined ? { greeting } : {}),
      ...(neverSay !== undefined ? { neverSay } : {}),
      ...(Array.isArray(channels) ? { channels } : {}),
      ...(accentColor !== undefined ? { accentColor } : {}),
      ...(engagementDelay !== undefined ? { engagementDelay } : {}),
      ...(whatsappNumber !== undefined ? { whatsappNumber } : {}),
      ...(sellsDescription !== undefined ? { sellsDescription } : {}),
      ...(businessHours !== undefined ? { businessHours } : {}),
    };

    const appOrigin = new URL(req.url).origin;

    if (user.orgId) {
      const org = await updateOrgSettings(user.orgId, {
        ...(businessName ? { orgName: businessName } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...settings,
      });
      const key = await prisma.widgetKey.findFirst({
        where: { orgId: org.id, active: true },
      });
      return NextResponse.json({
        success: true,
        orgId: org.id,
        widgetPublicKey: key?.publicKey ?? null,
        embedSnippet: key ? embedSnippet(appOrigin, key.publicKey) : null,
      });
    }

    if (!businessName?.trim()) {
      return jsonError(400, "Business name is required.");
    }

    const { org, widgetPublicKey } = await createOrganizationForUser(user.id, {
      name: businessName.trim(),
      websiteUrl: website || undefined,
      industry: industry || undefined,
      country: country || undefined,
      currency: currency || undefined,
      settings,
    });

    publishMerchantCreated(org.id, org.name, org.slug);
    if (widgetPublicKey) {
      publishWidgetInstalled(org.id);
    }

    // Claim the website in the registry
    if (website) {
      try {
        await connectWebsite(org.id, { url: website });
      } catch {
        // Non-blocking — the merchant can always reconnect later
      }
    }

    return NextResponse.json({
      success: true,
      orgId: org.id,
      widgetPublicKey,
      embedSnippet: embedSnippet(appOrigin, widgetPublicKey),
    });
  });
}
