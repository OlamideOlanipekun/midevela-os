import prisma from "@/lib/prisma";
import type { BrandTheme } from "@prisma/client";
import { detectBrandFromUrl } from "./detector";
import { generateWidgetTheme } from "./themeGenerator";
import type { UpdateThemeInput } from "./types";
import { resolveThemeForOrg } from "./resolve";

/**
 * Executes brand detection and updates BrandTheme DB entry.
 * Respects manual overrides: if isAutoDetected is false, detected branding is saved
 * but merchant overrides remain untouched.
 */
export async function detectAndSaveBrand(
  websiteId: string,
  orgId: string,
  url: string
): Promise<BrandTheme> {
  const detected = await detectBrandFromUrl(url);
  const widgetTheme = generateWidgetTheme(detected);

  const existing = await prisma.brandTheme.findUnique({
    where: { websiteId },
  });

  if (existing) {
    return prisma.brandTheme.update({
      where: { websiteId },
      data: {
        logoUrl: detected.logoUrl,
        faviconUrl: detected.faviconUrl,
        primaryColor: detected.primaryColor,
        secondaryColor: detected.secondaryColor,
        accentColor: detected.accentColor,
        backgroundColor: detected.backgroundColor,
        fontFamily: detected.fontFamily,
        borderRadius: detected.borderRadius,
        borderRadiusStyle: detected.borderRadiusStyle,
        buttonStyle: detected.buttonStyle as any,
        themeMode: detected.themeMode,
        widgetTheme: widgetTheme as any,
      },
    });
  }

  return prisma.brandTheme.create({
    data: {
      websiteId,
      orgId,
      logoUrl: detected.logoUrl,
      faviconUrl: detected.faviconUrl,
      primaryColor: detected.primaryColor,
      secondaryColor: detected.secondaryColor,
      accentColor: detected.accentColor,
      backgroundColor: detected.backgroundColor,
      fontFamily: detected.fontFamily,
      borderRadius: detected.borderRadius,
      borderRadiusStyle: detected.borderRadiusStyle,
      buttonStyle: detected.buttonStyle as any,
      themeMode: detected.themeMode,
      widgetTheme: widgetTheme as any,
      isAutoDetected: true,
      overrides: {},
    },
  });
}

/**
 * Updates manual theme overrides (Phase 3). Sets isAutoDetected = false.
 */
export async function updateMerchantTheme(
  orgId: string,
  input: UpdateThemeInput
): Promise<BrandTheme> {
  let brandTheme = await prisma.brandTheme.findFirst({
    where: { orgId },
  });

  if (!brandTheme) {
    const website = await prisma.websiteRegistry.findFirst({
      where: { orgId, status: "ACTIVE" },
    });
    if (!website) {
      throw new Error("No active website found for this organization.");
    }
    brandTheme = await prisma.brandTheme.create({
      data: {
        websiteId: website.id,
        orgId,
        isAutoDetected: false,
        overrides: {},
      },
    });
  }

  const currentOverrides = (brandTheme.overrides ?? {}) as Record<string, unknown>;

  const updatedOverrides = {
    ...currentOverrides,
    ...(input.primaryColor !== undefined ? { primary: input.primaryColor, header: input.primaryColor, launcher: input.primaryColor, userBubble: input.primaryColor } : {}),
    ...(input.secondaryColor !== undefined ? { secondary: input.secondaryColor } : {}),
    ...(input.accentColor !== undefined ? { accent: input.accentColor } : {}),
    ...(input.backgroundColor !== undefined ? { background: input.backgroundColor } : {}),
    ...(input.headerColor !== undefined ? { header: input.headerColor } : {}),
    ...(input.launcherColor !== undefined ? { launcher: input.launcherColor } : {}),
    ...(input.userBubbleColor !== undefined ? { userBubble: input.userBubbleColor } : {}),
    ...(input.assistantBubbleColor !== undefined ? { assistantBubble: input.assistantBubbleColor } : {}),
    ...(input.borderStyle !== undefined ? { border: input.borderStyle } : {}),
    ...(input.fontFamily !== undefined ? { fontFamily: input.fontFamily } : {}),
    ...(input.borderRadius !== undefined ? { borderRadius: input.borderRadius } : {}),
    ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
    ...(input.assistantName !== undefined ? { assistantName: input.assistantName } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.launcherStyle !== undefined ? { launcherStyle: input.launcherStyle } : {}),
    ...(input.position !== undefined ? { position: input.position } : {}),
    ...(input.animation !== undefined ? { animation: input.animation } : {}),
    ...(input.launcherSize !== undefined ? { launcherSize: input.launcherSize } : {}),
    ...(input.headerHeight !== undefined ? { headerHeight: input.headerHeight } : {}),
  };

  return prisma.brandTheme.update({
    where: { id: brandTheme.id },
    data: {
      overrides: updatedOverrides as any,
      isAutoDetected: false,
      ...(input.launcherStyle ? { launcherStyle: input.launcherStyle } : {}),
      ...(input.position ? { widgetPosition: input.position } : {}),
      ...(input.animation ? { animation: input.animation } : {}),
      ...(input.launcherSize ? { launcherSize: input.launcherSize } : {}),
      ...(input.headerHeight ? { headerHeight: input.headerHeight } : {}),
    },
  });
}

/**
 * Resets theme overrides to auto-detected values and triggers re-detection.
 */
export async function redetectMerchantTheme(orgId: string): Promise<BrandTheme> {
  const website = await prisma.websiteRegistry.findFirst({
    where: { orgId, status: "ACTIVE" },
  });
  if (!website) {
    throw new Error("No active website found to detect branding from.");
  }

  const brandTheme = await prisma.brandTheme.findFirst({
    where: { orgId },
  });

  if (brandTheme) {
    await prisma.brandTheme.update({
      where: { id: brandTheme.id },
      data: {
        isAutoDetected: true,
        overrides: {},
      },
    });
  }

  return detectAndSaveBrand(website.id, orgId, website.normalizedUrl);
}
