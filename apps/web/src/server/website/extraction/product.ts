import { extractDocument, jsonLdObjects, jsonLdHasType } from "@/server/website/extraction/document";
import { absolutize } from "@/server/website/crawler/canonical";

/**
 * Product extraction from a single fetched page. Deterministic first
 * (JSON-LD schema.org/Product, then DOM signals) — no LLM on the happy
 * path. The orchestrator decides when a page is a PRODUCT page and calls
 * into here.
 */

export interface ProductVariant {
  title?: string;
  sku?: string;
  price?: number;
  compareAtPrice?: number;
  size?: string;
  color?: string;
  inStock?: boolean;
}

export interface ExtractedProduct {
  name: string;
  description: string;
  price?: number;
  compareAtPrice?: number;
  currency: string;
  sku?: string;
  externalId?: string;
  brand?: string;
  category?: string;
  availability?: string;
  size?: string[];
  color?: string[];
  variants?: ProductVariant[];
  sourceUrl: string;
  canonicalUrl: string;
  images: string[];
}

interface PriceInfo {
  price?: number;
  compareAtPrice?: number;
  currency?: string;
  availability?: string;
}

function cleanPrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const num = Number(value.replace(/[,\s]/g, ""));
    if (Number.isFinite(num)) return num;
  }
  return undefined;
}

const CURRENCY_RE = /(?:₦|NGN|NG₦|\$|USD|£|GBP|€|EUR|KSh|KES|GH₵|GHS|ZAR|R)/i;

function currencyFromText(text: string): string | undefined {
  const m = CURRENCY_RE.exec(text);
  if (!m) return undefined;
  const sym = m[0];
  if (sym === "₦" || /NG|NGN/i.test(sym)) return "NGN";
  if (sym === "$" || /USD/i.test(sym)) return "USD";
  if (sym === "£" || /GBP/i.test(sym)) return "GBP";
  if (sym === "€" || /EUR/i.test(sym)) return "EUR";
  if (/KSh|KES/i.test(sym)) return "KES";
  if (/GH₵|GHS/i.test(sym)) return "GHS";
  if (/ZAR/i.test(sym)) return "ZAR";
  return undefined;
}

/** Regex prices like ₦12,500 / $19.99 / 12,500.00 from body text. */
function priceFromBodyText(body: string): PriceInfo {
  const re = /(?:₦|NGN|NG₦|\$|£|€|KSh|GH₵|R)\s?([\d,]+(?:\.\d{1,2})?)/gi;
  const prices: Array<{ value: number; currency?: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const num = Number(m[1].replace(/,/g, ""));
    if (Number.isNaN(num) || num <= 0) continue;
    prices.push({ value: num, currency: currencyFromText(m[0]) });
  }
  const freq = new Map<number, { count: number; currency?: string }>();
  for (const p of prices) {
    const f = freq.get(p.value) ?? { count: 0, currency: p.currency };
    f.count++;
    f.currency = f.currency ?? p.currency;
    freq.set(p.value, f);
  }
  if (prices.length === 0) return {};
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1].count - a[1].count);
  const primary = sorted[0];
  return {
    price: primary[0],
    compareAtPrice: sorted[1] && sorted[1][0] > primary[0] ? sorted[1][0] : undefined,
    currency: primary[1].currency,
  };
}

function normalizeOffer(offer: unknown): PriceInfo {
  if (!offer || typeof offer !== "object") return {};
  const o = offer as Record<string, unknown>;
  const price = cleanPrice(o.price) ?? cleanPrice(o.lowPrice);
  const compareAtPrice = cleanPrice(o.compareAtPrice) ?? cleanPrice(o.highPrice);
  const currency =
    typeof o.priceCurrency === "string" && o.priceCurrency ? o.priceCurrency : undefined;
  const availability =
    typeof o.availability === "string"
      ? String(o.availability).split("/").pop() ?? ""
      : undefined;
  return { price, compareAtPrice, currency, availability };
}

function normalizeImage(value: unknown): string[] {
  const imgs: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      imgs.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      walk(o.url ?? o.contentUrl);
    }
  };
  walk(value);
  return imgs;
}

/** Extract a product from JSON-LD. Returns null if no Product object. */
export function extractProductFromJsonLd(
  jsonLd: unknown[],
  pageUrl: string
): ExtractedProduct | null {
  const objects = jsonLdObjects(jsonLd);
  const product = objects.find((o) => jsonLdHasType(o, "Product") || jsonLdHasType(o, "ProductGroup"));
  if (!product) return null;

  const name = typeof product.name === "string" ? product.name.trim() : "";
  if (!name) return null;

  const offersRaw = product.offers;
  const offers = Array.isArray(offersRaw)
    ? offersRaw.filter((o): o is unknown => !!o && typeof o === "object")
    : offersRaw
      ? [offersRaw]
      : [];
  const offer = normalizeOffer(offers[0]);

  const description =
    typeof product.description === "string" ? product.description.trim() : "";
  const sku =
    typeof product.sku === "string" && product.sku ? product.sku : undefined;
  const brand =
    product.brand && typeof product.brand === "object"
      ? String((product.brand as Record<string, unknown>).name ?? "")
      : typeof product.brand === "string"
        ? product.brand
        : undefined;

  const category =
    product.category && typeof product.category === "object"
      ? String((product.category as Record<string, unknown>).name ?? "")
      : typeof product.category === "string"
        ? product.category
        : undefined;

  const rawSize = product.size;
  const size: string[] = Array.isArray(rawSize)
    ? rawSize.map(String)
    : typeof rawSize === "string"
      ? [rawSize]
      : [];

  const rawColor = product.color;
  const color: string[] = Array.isArray(rawColor)
    ? rawColor.map(String)
    : typeof rawColor === "string"
      ? [rawColor]
      : [];

  const variantsRaw = product.hasVariant || product.variant;
  const variantObjs = Array.isArray(variantsRaw)
    ? variantsRaw
    : variantsRaw && typeof variantsRaw === "object"
      ? [variantsRaw]
      : [];

  const variants: ProductVariant[] = variantObjs.map((v: any) => {
    const vOffer = normalizeOffer(v.offers);
    return {
      title: typeof v.name === "string" ? v.name : undefined,
      sku: typeof v.sku === "string" ? v.sku : undefined,
      price: vOffer.price ?? offer.price,
      compareAtPrice: vOffer.compareAtPrice ?? offer.compareAtPrice,
      size: typeof v.size === "string" ? v.size : undefined,
      color: typeof v.color === "string" ? v.color : undefined,
      inStock: vOffer.availability ? !/outofstock/i.test(vOffer.availability) : true,
    };
  });

  const images = normalizeImage(product.image).slice(0, 8);
  const canonicalRaw = typeof product.url === "string" ? product.url : pageUrl;
  const canonicalUrl =
    absolutize(canonicalRaw, pageUrl) ||
    (pageUrl.startsWith("http") ? pageUrl : "");

  return {
    name: name.slice(0, 500),
    description: description.slice(0, 10000),
    price: offer.price,
    compareAtPrice: offer.compareAtPrice,
    currency: offer.currency ?? "",
    sku: sku?.slice(0, 200),
    externalId: sku?.slice(0, 200),
    brand: brand?.slice(0, 200),
    category: category?.slice(0, 200),
    availability: offer.availability,
    size,
    color,
    variants,
    sourceUrl: pageUrl,
    canonicalUrl,
    images,
  };
}

/** DOM fallback: combine title/h1 + body price signals. Low precision by
 *  design — the orchestrator prefers JSON-LD and only calls this when the
 *  page plausibly is a product page and JSON-LD yielded nothing. */
export function extractProductFromDom(
  html: string,
  pageUrl: string
): ExtractedProduct | null {
  const doc = extractDocument(html, { baseUrl: pageUrl });
  const name = doc.title.trim() || doc.h1s[0] || "";
  if (!name) return null;

  const body = [
    doc.title,
    ...doc.h1s,
    ...doc.paragraphs.slice(0, 25),
  ].join(" ");
  const { price, compareAtPrice, currency } = priceFromBodyText(body);

  const canonicalUrl =
    doc.canonicals[0]?.startsWith("http") ? doc.canonicals[0] : pageUrl;

  return {
    name: name.slice(0, 500),
    description: doc.paragraphs.slice(0, 3).join(" ").slice(0, 10000),
    price,
    compareAtPrice,
    currency: currency ?? "",
    sourceUrl: pageUrl,
    canonicalUrl,
    images: doc.images.slice(0, 8).map((i) => i.src),
  };
}