import type { DetectedBrand, WidgetTheme } from "./types";

/**
 * Converts a hex color to {h, s, l}.
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let hStr = String(hex || "").trim().replace(/^#/, "");
  if (hStr.length === 3) {
    hStr = hStr.split("").map((c) => c + c).join("");
  }
  const r = parseInt(hStr.slice(0, 2) || "00", 16) / 255;
  const g = parseInt(hStr.slice(2, 4) || "00", 16) / 255;
  const b = parseInt(hStr.slice(4, 6) || "00", 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Converts {h, s, l} back to hex string.
 */
function hslToHex(h: number, s: number, l: number): string {
  const sPct = s / 100;
  const lPct = l / 100;
  const c = (1 - Math.abs(2 * lPct - 1)) * sPct;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lPct - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Determines text contrast color (black or white) for a given background hex color.
 */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#08120a";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#08120a" : "#ffffff";
}

/**
 * Generate a complete, accessible WidgetTheme map from detected brand elements.
 */
export function generateWidgetTheme(detected: Partial<DetectedBrand>): WidgetTheme {
  const primary = detected.primaryColor || "#0F62FE";
  const secondary = detected.secondaryColor || "#EAF2FF";
  const accent = detected.accentColor || primary;
  const isDark = detected.themeMode === "DARK";

  const { h, s } = hexToHsl(primary);

  // Derive component tokens using color math
  const header = primary;
  const launcher = primary;
  const userBubble = primary;
  const assistantBubble = isDark ? "#1E293B" : "#FFFFFF";
  const background = isDark ? "#0F172A" : "#F8FAFC";
  
  // Quick reply chip background (very light 92-96% lightness tint of primary)
  const quickReply = isDark ? hslToHex(h, Math.min(s, 30), 20) : hslToHex(h, Math.min(s, 40), 96);
  const border = isDark ? "#334155" : "#E2E8F0";
  const onPrimary = contrastText(primary);
  const fontFamily = detected.fontFamily || "Inter";
  const borderRadius = detected.borderRadius || "16px";

  return {
    header,
    launcher,
    userBubble,
    assistantBubble,
    background,
    quickReply,
    border,
    fontFamily,
    borderRadius,
    onPrimary,
    primary,
    secondary,
    accent,
  };
}
