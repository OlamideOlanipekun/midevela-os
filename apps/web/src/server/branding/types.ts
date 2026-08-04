import type { BorderRadiusStyle, LauncherStyle, ThemeMode, WidgetAnimation, WidgetPosition } from "@prisma/client";

export interface DetectedBrand {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  fontFamily: string | null;
  borderRadius: string | null;
  borderRadiusStyle: BorderRadiusStyle | null;
  buttonStyle: Record<string, unknown> | null;
  themeMode: ThemeMode;
}

export interface WidgetTheme {
  header: string;
  launcher: string;
  userBubble: string;
  assistantBubble: string;
  background: string;
  quickReply: string;
  border: string;
  fontFamily: string;
  borderRadius: string;
  onPrimary: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface ResolvedWidgetTheme extends WidgetTheme {
  logoUrl: string | null;
  faviconUrl: string | null;
  businessName: string;
  assistantName: string;
  launcherStyle: LauncherStyle;
  position: WidgetPosition;
  animation: WidgetAnimation;
  launcherSize: number;
  headerHeight: number;
  isAutoDetected: boolean;
}

export interface UpdateThemeInput {
  businessName?: string;
  assistantName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  headerColor?: string;
  launcherColor?: string;
  userBubbleColor?: string;
  assistantBubbleColor?: string;
  borderStyle?: string;
  launcherStyle?: LauncherStyle;
  position?: WidgetPosition;
  animation?: WidgetAnimation;
  launcherSize?: number;
  headerHeight?: number;
}
