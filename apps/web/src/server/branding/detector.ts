import type { DetectedBrand } from "./types";
import { BorderRadiusStyle, ThemeMode } from "@prisma/client";

/**
 * Normalizes relative URLs to absolute URLs using baseUrl.
 */
function toAbsoluteUrl(relativeOrAbsolute: string, baseUrl: string): string | null {
  if (!relativeOrAbsolute) return null;
  const s = relativeOrAbsolute.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  try {
    return new URL(s, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Validates hex color.
 */
function isValidHex(hex: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(hex.trim());
}

/**
 * Extracts hex colors from a string (CSS / HTML).
 */
function extractHexColors(text: string): string[] {
  const matches = text.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
  return Array.from(new Set(matches.map((c) => c.toLowerCase())));
}

/**
 * Detect logo URL and favicon URL with priority:
 * 1. Open Graph Image
 * 2. <img class="logo"> or id="logo" or alt="logo"
 * 3. Inline or header SVG logo
 * 4. Header Image
 * 5. Favicon
 */
function detectLogoAndFavicon(html: string, baseUrl: string): { logoUrl: string | null; faviconUrl: string | null } {
  let logoUrl: string | null = null;
  let faviconUrl: string | null = null;

  // 1. Favicon detection
  const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/i) ||
                       html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i);
  if (faviconMatch && faviconMatch[1]) {
    faviconUrl = toAbsoluteUrl(faviconMatch[1], baseUrl);
  } else {
    faviconUrl = toAbsoluteUrl("/favicon.ico", baseUrl);
  }

  // 2. Open Graph Image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch && ogMatch[1]) {
    logoUrl = toAbsoluteUrl(ogMatch[1], baseUrl);
  }

  // 3. Img with logo in class/id/alt/src if OG image not present or as fallback
  if (!logoUrl) {
    const imgLogoMatch = html.match(/<img[^>]*(?:class|id|alt|src)=["'][^"']*(?:logo|brand)[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
                         html.match(/<img[^>]*src=["']([^"']+)["'][^>]*(?:class|id|alt)=["'][^"']*(?:logo|brand)[^"']*["']/i);
    if (imgLogoMatch && imgLogoMatch[1]) {
      logoUrl = toAbsoluteUrl(imgLogoMatch[1], baseUrl);
    }
  }

  // 4. Header image
  if (!logoUrl) {
    const headerMatch = html.match(/<header[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i);
    if (headerMatch && headerMatch[1]) {
      logoUrl = toAbsoluteUrl(headerMatch[1], baseUrl);
    }
  }

  // Fallback logo to favicon if none found
  if (!logoUrl) {
    logoUrl = faviconUrl;
  }

  return { logoUrl, faviconUrl };
}

/**
 * Detect brand colors from CSS variables, styles, navigation, and buttons.
 */
function detectColors(html: string): {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
} {
  // Check CSS variable declarations first (--primary, --brand, etc.)
  const cssVarPrimary = html.match(/--(?:primary|brand|main)(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i);
  const cssVarSecondary = html.match(/--(?:secondary|accent|sub)(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i);
  const cssVarAccent = html.match(/--accent(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i);

  let primaryColor: string | null = cssVarPrimary && isValidHex(cssVarPrimary[1]) ? cssVarPrimary[1] : null;
  let secondaryColor: string | null = cssVarSecondary && isValidHex(cssVarSecondary[1]) ? cssVarSecondary[1] : null;
  let accentColor: string | null = cssVarAccent && isValidHex(cssVarAccent[1]) ? cssVarAccent[1] : null;
  let backgroundColor: string | null = null;

  // Extract all hex colors found in the document
  const colors = extractHexColors(html);
  
  // Filter out pure white, pure black, and common neutral grays for primary selection
  const nonNeutralColors = colors.filter((c) => {
    const lower = c.toLowerCase();
    return !["#fff", "#ffffff", "#000", "#000000", "#fff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#1e293b", "#0f172a"].includes(lower);
  });

  if (!primaryColor && nonNeutralColors.length > 0) {
    primaryColor = nonNeutralColors[0];
  }
  if (!secondaryColor && nonNeutralColors.length > 1) {
    secondaryColor = nonNeutralColors[1];
  }
  if (!accentColor) {
    accentColor = primaryColor;
  }

  // Detect background color
  const bgMatch = html.match(/(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{3,6})/i);
  if (bgMatch && isValidHex(bgMatch[1])) {
    backgroundColor = bgMatch[1];
  }

  return { primaryColor, secondaryColor, accentColor, backgroundColor };
}

/**
 * Detect primary font family.
 */
function detectFonts(html: string): string {
  const fontMatch = html.match(/font-family\s*:\s*["']?([^"';,}]+)/i);
  if (fontMatch && fontMatch[1]) {
    const font = fontMatch[1].trim().replace(/['"]/g, "");
    if (font && !["inherit", "initial", "unset", "sans-serif"].includes(font.toLowerCase())) {
      return font;
    }
  }

  // Check Google Fonts links
  const gfMatch = html.match(/fonts\.googleapis\.com\/css2\?family=([^&:]+)/i);
  if (gfMatch && gfMatch[1]) {
    return decodeURIComponent(gfMatch[1]).replace(/\+/g, " ");
  }

  return "Inter";
}

/**
 * Detect border radius and map to BorderRadiusStyle.
 */
function detectBorderRadius(html: string): { borderRadius: string; style: BorderRadiusStyle } {
  const radiusMatch = html.match(/border-radius\s*:\s*([0-9.]+(?:px|rem|em|%))/i);
  let radius = "16px";
  let style: BorderRadiusStyle = BorderRadiusStyle.ROUNDED;

  if (radiusMatch && radiusMatch[1]) {
    const raw = radiusMatch[1];
    radius = raw;

    if (raw.endsWith("px")) {
      const val = parseFloat(raw);
      if (val === 0) style = BorderRadiusStyle.SQUARE;
      else if (val <= 6) style = BorderRadiusStyle.SLIGHTLY_ROUNDED;
      else if (val <= 16) style = BorderRadiusStyle.ROUNDED;
      else style = BorderRadiusStyle.PILL;
    } else if (raw === "9999px" || raw === "50%" || raw === "100%") {
      style = BorderRadiusStyle.PILL;
    }
  }

  return { borderRadius: radius, style };
}

/**
 * Crawl website homepage and run visual identity detection.
 */
export async function detectBrandFromUrl(url: string): Promise<DetectedBrand> {
  const targetUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let html = "";

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "MidevelaBrandDetector/1.0 (+https://midevela.com)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch (err) {
    console.warn(`[BrandDetector] Could not fetch ${targetUrl}:`, err);
  }

  const { logoUrl, faviconUrl } = detectLogoAndFavicon(html, targetUrl);
  const colors = detectColors(html);
  const fontFamily = detectFonts(html);
  const { borderRadius, style: borderRadiusStyle } = detectBorderRadius(html);

  return {
    logoUrl,
    faviconUrl,
    primaryColor: colors.primaryColor || "#0F62FE",
    secondaryColor: colors.secondaryColor || "#EAF2FF",
    accentColor: colors.accentColor || colors.primaryColor || "#0F62FE",
    backgroundColor: colors.backgroundColor || "#FFFFFF",
    fontFamily,
    borderRadius,
    borderRadiusStyle,
    buttonStyle: null,
    themeMode: ThemeMode.LIGHT,
  };
}
