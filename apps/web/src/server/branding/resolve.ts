import prisma from "@/lib/prisma";
import type { ResolvedWidgetTheme, WidgetTheme } from "./types";
import { generateWidgetTheme } from "./themeGenerator";
import { defaultOrgSettings } from "@/server/tenancy/org";
import { LauncherStyle, WidgetAnimation, WidgetPosition } from "@prisma/client";

/**
 * Resolves the final composite widget theme for an organization.
 * Merges auto-detected branding with merchant overrides.
 */
export async function resolveThemeForOrg(orgId: string): Promise<ResolvedWidgetTheme> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, settings: true },
  });

  const brandTheme = await prisma.brandTheme.findFirst({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });

  const defaultTheme = generateWidgetTheme({
    primaryColor: (org?.settings as any)?.accentColor || defaultOrgSettings.accentColor,
  });

  if (!brandTheme) {
    return {
      ...defaultTheme,
      logoUrl: null,
      faviconUrl: null,
      businessName: org?.name || "Store",
      assistantName: (org?.settings as any)?.aiName || defaultOrgSettings.aiName,
      launcherStyle: LauncherStyle.CIRCLE,
      position: WidgetPosition.BOTTOM_RIGHT,
      animation: WidgetAnimation.FADE,
      launcherSize: 56,
      headerHeight: 64,
      isAutoDetected: true,
    };
  }

  const detectedTheme = (brandTheme.widgetTheme ?? {}) as Partial<WidgetTheme>;
  const overrides = (brandTheme.overrides ?? {}) as Partial<WidgetTheme & {
    businessName?: string;
    assistantName?: string;
    logoUrl?: string;
    launcherStyle?: LauncherStyle;
    position?: WidgetPosition;
    animation?: WidgetAnimation;
    launcherSize?: number;
    headerHeight?: number;
  }>;

  const mergedTheme: WidgetTheme = {
    header: overrides.header || detectedTheme.header || brandTheme.primaryColor || defaultTheme.header,
    launcher: overrides.launcher || detectedTheme.launcher || brandTheme.primaryColor || defaultTheme.launcher,
    userBubble: overrides.userBubble || detectedTheme.userBubble || brandTheme.primaryColor || defaultTheme.userBubble,
    assistantBubble: overrides.assistantBubble || detectedTheme.assistantBubble || defaultTheme.assistantBubble,
    background: overrides.background || detectedTheme.background || defaultTheme.background,
    quickReply: overrides.quickReply || detectedTheme.quickReply || defaultTheme.quickReply,
    border: overrides.border || detectedTheme.border || defaultTheme.border,
    fontFamily: overrides.fontFamily || brandTheme.fontFamily || defaultTheme.fontFamily,
    borderRadius: overrides.borderRadius || brandTheme.borderRadius || defaultTheme.borderRadius,
    onPrimary: overrides.onPrimary || detectedTheme.onPrimary || defaultTheme.onPrimary,
    primary: overrides.primary || brandTheme.primaryColor || defaultTheme.primary,
    secondary: overrides.secondary || brandTheme.secondaryColor || defaultTheme.secondary,
    accent: overrides.accent || brandTheme.accentColor || defaultTheme.accent,
  };

  return {
    ...mergedTheme,
    logoUrl: overrides.logoUrl || brandTheme.logoUrl || null,
    faviconUrl: brandTheme.faviconUrl || null,
    businessName: overrides.businessName || brandTheme.businessName || org?.name || "Store",
    assistantName: overrides.assistantName || brandTheme.assistantName || (org?.settings as any)?.aiName || defaultOrgSettings.aiName,
    launcherStyle: overrides.launcherStyle || brandTheme.launcherStyle || LauncherStyle.CIRCLE,
    position: overrides.position || brandTheme.widgetPosition || WidgetPosition.BOTTOM_RIGHT,
    animation: overrides.animation || brandTheme.animation || WidgetAnimation.FADE,
    launcherSize: overrides.launcherSize || brandTheme.launcherSize || 56,
    headerHeight: overrides.headerHeight || brandTheme.headerHeight || 64,
    isAutoDetected: brandTheme.isAutoDetected,
  };
}
