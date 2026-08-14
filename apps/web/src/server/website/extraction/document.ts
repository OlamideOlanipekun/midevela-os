import { absolutize } from "@/server/website/crawler/canonical";

/**
 * DOM-agnostic document extraction from raw HTML.
 *
 * This is deliberately regex-based (no DOM library) so the crawler keeps a
 * tiny dependency surface and works offline in the worker. Trade-off:
 * malformed HTML may lose some nodes, but extraction is *fallback-tolerant* —
 * title/h1/paragraphs/JSON-LD each degrade independently.
 */

export interface PageHeading {
  level: number;
  text: string;
}

export interface PageLink {
  href: string;
  text: string;
}

export interface PageImage {
  src: string;
  alt: string;
}

export interface ExtractedDocument {
  title: string;
  h1s: string[];
  metaDescription: string;
  canonicals: string[];
  headings: PageHeading[];
  paragraphs: string[];
  links: PageLink[];
  images: PageImage[];
  jsonLd: unknown[];
}

interface ExtractOptions {
  /** Base URL to resolve relative hrefs/srcs against. */
  baseUrl?: string;
}

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const TAGS_RE = /<[^>]+>/g;
const WS_RE = /\s+/g;

function decode(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return "";
      }
    });
}

/** Collapse an element's inner HTML to clean visible text. */
export function innerText(html: string): string {
  return decode(
    html
      .replace(SCRIPT_RE, " ")
      .replace(STYLE_RE, " ")
      .replace(TAGS_RE, " ")
  )
    .replace(WS_RE, " ")
    .trim();
}

function absolute(href: string, baseUrl?: string): string {
  const abs = absolutize(href, baseUrl ?? "");
  return abs;
}

/** Extract a single <title> element. */
export function extractTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? innerText(m[1]) : "";
}

/** Extract all <h1>..<h6> headings, in document order. */
export function extractHeadings(html: string, baseUrl?: string): PageHeading[] {
  const out: PageHeading[] = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = innerText(m[2]);
    if (!text) continue;
    out.push({ level: Number(m[1]), text });
    if (out.length >= 200) break;
  }
  return out;
}

/** Extract the primary H1 (first non-empty). */
export function extractH1s(html: string): string[] {
  const headings = extractHeadings(html);
  return headings.filter((h) => h.level === 1).map((h) => h.text);
}

export function extractMetaDescription(html: string): string {
  const m =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(html);
  return m ? decode(m[1]).trim() : "";
}

export function extractCanonicals(html: string, baseUrl?: string): string[] {
  const out: string[] = [];
  const re = /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = /href=["']([^"']+)["']/i.exec(m[0]);
    if (href) {
      const abs = absolute(href[1], baseUrl);
      if (abs) out.push(abs);
    }
  }
  return out;
}

/** Extract <p> paragraphs as clean text. */
export function extractParagraphs(html: string): string[] {
  const out: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = innerText(m[1]);
    if (text.length >= 2) {
      out.push(text);
      if (out.length >= 500) break;
    }
  }
  return out;
}

export function extractLinks(html: string, baseUrl?: string): PageLink[] {
  const out: PageLink[] = [];
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    const abs = absolute(href, baseUrl) || href;
    out.push({ href: abs, text: innerText(m[2]).slice(0, 200) });
    if (out.length >= 2000) break;
  }
  return out;
}

export function extractImages(html: string, baseUrl?: string): PageImage[] {
  const out: PageImage[] = [];
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const attr = (name: string) => {
      const a = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
      return a ? a[1].trim() : "";
    };
    // Prefer lazy-load attributes, falling back to src.
    const src = attr("data-src") || attr("data-original") || attr("data-lazy-src") || attr("src");
    if (!src) continue;
    const abs = absolute(src, baseUrl) || src;
    if (!/^https?:\/\//i.test(abs)) continue;
    out.push({ src: abs, alt: decode(attr("alt")).slice(0, 300) });
    if (out.length >= 200) break;
  }
  return out;
}

/** Extract all <script type="application/ld+json"> blocks, parsed. */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // Malformed JSON-LD — skip this block, keep going.
    }
    if (out.length >= 50) break;
  }
  return out;
}

/** Convenience: check one JSON-LD object (or array/string @type) for a type. */
export function jsonLdHasType(obj: unknown, type: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  const t = (obj as Record<string, unknown>)["@type"];
  if (Array.isArray(t)) return t.some((x) => String(x) === type);
  return String(t ?? "") === type;
}

/** Flatten the JSON-LD array to objects (skips @graph wrappers). */
export function jsonLdObjects(jsonLd: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const node of jsonLd) {
    if (Array.isArray(node)) {
      out.push(...jsonLdObjects(node));
      continue;
    }
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      out.push(...jsonLdObjects(obj["@graph"] as unknown[]));
      continue;
    }
    out.push(obj);
  }
  return out;
}

/** Full-document extraction. Everything is fallback-tolerant. */
export function extractDocument(html: string, options: ExtractOptions = {}): ExtractedDocument {
  const { baseUrl } = options;
  return {
    title: extractTitle(html),
    h1s: extractH1s(html),
    metaDescription: extractMetaDescription(html),
    canonicals: extractCanonicals(html, baseUrl),
    headings: extractHeadings(html),
    paragraphs: extractParagraphs(html),
    links: extractLinks(html, baseUrl),
    images: extractImages(html, baseUrl),
    jsonLd: extractJsonLd(html),
  };
}