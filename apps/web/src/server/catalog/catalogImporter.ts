import { assertPublicUrl } from "@/server/net/ssrfGuard";
import { importProducts, type ImportRow, type ImportResult } from "@/server/catalog/products";
import { normalizeCurrencyCode } from "@/server/catalog/money";

/**
 * Layered catalog importer. Tries strategies cheapest-and-most-accurate
 * first, stops at the first that yields products, then persists them
 * through importProducts (dedupe + embeddings + category auto-seed).
 *
 *   1. Platform JSON (Shopify /products.json, WooCommerce Store API)
 *      — exact, free, and (crucially) NOT behind the storefront's bot
 *        wall, so it works on protected Shopify/Woo stores.
 *   2. JSON-LD (schema.org Product) from the fetched HTML — exact, free.
 *   3. fetch + Groq LLM extraction — free, handles server-rendered sites.
 *   4. Firecrawl + Groq — paid (optional), renders JS-heavy sites; runs
 *      last so it only spends credits when the free paths found nothing.
 *
 * Bot protection: strategy 1 routes around it entirely for the common
 * platforms; strategy 4 escalates to Firecrawl's stealth proxy; and if
 * everything fails, the caller falls back to CSV/manual (the merchant
 * owns this catalog and can always export it themselves).
 */

const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_PRODUCTS = 250;
const FETCH_TIMEOUT_MS = 8000;

export type ImportStrategy = "shopify" | "woocommerce" | "json-ld" | "fetch-llm" | "firecrawl" | "none";

export interface CatalogImportResult extends ImportResult {
  strategy: ImportStrategy;
  found: number;
}

// ─── helpers ───────────────────────────────────────────────────────────

/**
 * Resolves a possibly-relative image URL (site-relative "/img/x.jpg",
 * protocol-relative "//cdn.x.com/y.jpg", or already-absolute) against the
 * page it came from, so the widget always gets a real, loadable image
 * instead of silently dropping it (safeHttpUrl/firstImageUrl in
 * server/retrieval/search.ts only accept absolute http(s) URLs).
 */
function absolutizeUrl(maybe: string | undefined, base: string): string {
  if (!maybe) return "";
  try {
    const resolved = new URL(maybe, base);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.toString() : "";
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Filenames that are almost never the actual product photo — nav logos,
// payment badges, UI sprites — so the LLM isn't distracted by them.
const NON_PRODUCT_IMAGE = /logo|icon|sprite|badge|payment|favicon|avatar|placeholder/i;

/** Pulls the real image URL out of an <img> tag, preferring lazy-load
 *  attributes (data-src, srcset) over `src`, since many storefronts put a
 *  1x1 placeholder gif in `src` and the real photo in a data-* attribute. */
function imgSrc(tag: string): string {
  const attr = (name: string) => {
    const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
    return m ? m[1].trim() : "";
  };
  const srcset = attr("data-srcset") || attr("srcset");
  const firstFromSrcset = srcset ? srcset.split(",")[0].trim().split(/\s+/)[0] : "";
  return attr("data-src") || attr("data-original") || attr("data-lazy-src") || firstFromSrcset || attr("src");
}

/** Like stripHtml, but turns <img> tags into inline `![alt](url)` markers
 *  first, so a product's photo survives into the text the LLM sees instead
 *  of being discarded along with every other tag. */
function htmlToMarkdownish(html: string, baseUrl: string): string {
  const withImages = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = imgSrc(tag);
      if (!src || NON_PRODUCT_IMAGE.test(src)) return "";
      const abs = absolutizeUrl(src, baseUrl);
      if (!abs) return "";
      const altMatch = tag.match(/alt\s*=\s*["']([^"']*)["']/i);
      return ` ![${altMatch ? altMatch[1] : ""}](${abs}) `;
    });
  return withImages
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A realistic browser UA. Many storefronts (and their public /products.json
// endpoints) block non-browser user-agents behind bot protection — with a
// bot UA, allbirds' free Shopify endpoint 403s and we waste a paid Firecrawl
// credit instead. The merchant is importing their own catalog, so presenting
// as a normal browser to read a public product endpoint is appropriate.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

async function timedFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json, text/html;q=0.9, */*;q=0.8",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Extract products from arbitrary page text/markdown via Groq (higher
 *  token cap than the conversation engine's completeJson). Never invents.
 *  When baseUrl is given, the content is expected to carry inline
 *  `![alt](url)` image markers (see htmlToMarkdownish / Firecrawl's own
 *  markdown output) and the LLM is asked to pair each product with the
 *  marker nearest it — never to invent a URL that isn't in the text. */
async function groqExtract(content: string, baseUrl?: string): Promise<ImportRow[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];
  const clipped = content.slice(0, 20000);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You extract e-commerce products from a storefront page. Return ONLY JSON: {"products":[{"name":string,"price":string,"category":string,"description":string,"imageUrl":string,"currency":string}]}. ' +
            "Only real purchasable products actually shown on the page. price is digits only (no currency symbol). " +
            "currency is the ISO 4217 code for whatever currency the page actually shows prices in — infer it from a symbol ($ = USD, ₦ or 'NGN' = NGN, £ = GBP, € = EUR) or an explicit code. " +
            "Use the SAME currency for every product unless the page clearly shows different currencies for different products. If you can't tell, leave currency empty — never guess. " +
            "The text may contain inline image markers like ![alt](url) — if one clearly belongs to a product (appears right next to its name/price), copy that URL verbatim into imageUrl. " +
            "Never invent or guess an image URL — only use one that appears literally in the given text, and leave imageUrl empty if none clearly matches. " +
            "If a field is unknown use an empty string. If there are no products return an empty array. Never invent products.",
        },
        { role: "user", content: `Storefront page content:\n\n${clipped}` },
      ],
    }),
  });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const products = Array.isArray(parsed.products) ? parsed.products : [];
    return products
      .filter((p: { name?: string }) => p && typeof p.name === "string" && p.name.trim())
      .slice(0, MAX_PRODUCTS)
      .map((p: { name: string; price?: string; category?: string; description?: string; imageUrl?: string; currency?: string }) => ({
        name: p.name.trim(),
        price: p.price ?? "",
        category: p.category ?? "",
        description: p.description ?? "",
        imageUrl: p.imageUrl && baseUrl ? absolutizeUrl(p.imageUrl, baseUrl) : "",
        currency: normalizeCurrencyCode(p.currency) ?? undefined,
      }));
  } catch {
    return [];
  }
}

// ─── strategy 1: platform JSON endpoints ─────────────────────────────────

async function tryShopify(origin: string): Promise<ImportRow[]> {
  const rows: ImportRow[] = [];
  for (let page = 1; page <= 2 && rows.length < MAX_PRODUCTS; page++) {
    const res = await timedFetch(`${origin}/products.json?limit=250&page=${page}`);
    if (!res || !res.ok) break;
    let data: { products?: unknown };
    try {
      data = await res.json();
    } catch {
      break;
    }
    const products = Array.isArray(data.products) ? data.products : [];
    if (products.length === 0) break;
    for (const p of products as Array<Record<string, unknown>>) {
      const variants = Array.isArray(p.variants) ? (p.variants as Array<Record<string, unknown>>) : [];
      const images = Array.isArray(p.images) ? (p.images as Array<Record<string, unknown>>) : [];
      const price = variants[0]?.price;
      if (!p.title || price === undefined) continue;
      rows.push({
        name: String(p.title),
        price: String(price),
        category: p.product_type ? String(p.product_type) : "",
        brand: p.vendor ? String(p.vendor) : "",
        description: p.body_html ? stripHtml(String(p.body_html)).slice(0, 600) : "",
        imageUrl: images[0]?.src ? absolutizeUrl(String(images[0].src), origin) : "",
      });
    }
  }
  return rows.slice(0, MAX_PRODUCTS);
}

async function tryWooCommerce(origin: string): Promise<ImportRow[]> {
  const res = await timedFetch(`${origin}/wp-json/wc/store/products?per_page=100`);
  if (!res || !res.ok) return [];
  let products: Array<Record<string, unknown>>;
  try {
    const data = await res.json();
    products = Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
  const rows: ImportRow[] = [];
  for (const p of products) {
    const prices = (p.prices ?? {}) as Record<string, unknown>;
    const minor = Number(prices.currency_minor_unit ?? 2);
    const rawPrice = Number(prices.price);
    if (!p.name || !Number.isFinite(rawPrice)) continue;
    const images = Array.isArray(p.images) ? (p.images as Array<Record<string, unknown>>) : [];
    const categories = Array.isArray(p.categories) ? (p.categories as Array<Record<string, unknown>>) : [];
    const categoryImage = categories[0]?.image as Record<string, unknown> | undefined;
    rows.push({
      name: String(p.name),
      price: String(rawPrice / Math.pow(10, minor)),
      category: categories[0]?.name ? String(categories[0].name) : "",
      description: p.short_description ? stripHtml(String(p.short_description)).slice(0, 600) : "",
      imageUrl: images[0]?.src ? absolutizeUrl(String(images[0].src), origin) : "",
      currency: normalizeCurrencyCode(prices.currency_code) ?? undefined,
      categoryImageUrl: (categoryImage?.src ? absolutizeUrl(String(categoryImage.src), origin) : "") || undefined,
    });
  }
  return rows.slice(0, MAX_PRODUCTS);
}

// ─── strategy 2: JSON-LD from fetched HTML ───────────────────────────────

function extractJsonLd(html: string, pageUrl: string): ImportRow[] {
  const rows: ImportRow[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const objects = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const obj of objects as Array<Record<string, unknown>>) {
        const type = obj["@type"] || obj["type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct || !obj.name) continue;
        const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
        const price = (offer as Record<string, unknown>)?.price;
        if (price === undefined) continue;
        const image = Array.isArray(obj.image) ? obj.image[0] : typeof obj.image === "object" ? (obj.image as Record<string, unknown>)?.url : obj.image;
        const priceCurrency = (offer as Record<string, unknown>)?.priceCurrency;
        rows.push({
          name: String(obj.name),
          price: String(price),
          brand: obj.brand ? String((obj.brand as Record<string, unknown>)?.name ?? obj.brand) : "",
          description: obj.description ? String(obj.description) : "",
          imageUrl: image ? absolutizeUrl(String(image), pageUrl) : "",
          currency: normalizeCurrencyCode(priceCurrency) ?? undefined,
        });
      }
    } catch {
      // malformed block — skip
    }
  }
  return rows.slice(0, MAX_PRODUCTS);
}

// ─── strategy 4: Firecrawl (paid, optional) ──────────────────────────────

async function tryFirecrawl(url: string, stealth: boolean): Promise<ImportRow[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      ...(stealth ? { proxy: "stealth" } : {}),
    }),
  });
  if (!res.ok) return [];
  let md = "";
  try {
    const data = await res.json();
    md = data?.data?.markdown ?? "";
  } catch {
    return [];
  }
  if (md.length < 40) return [];
  return groqExtract(md, url);
}

// ─── orchestrator ────────────────────────────────────────────────────────

export async function importCatalogFromUrl(orgId: string, rawUrl: string): Promise<CatalogImportResult> {
  const parsed = await assertPublicUrl(rawUrl); // SSRF guard, throws ApiError(400)
  const origin = parsed.origin;
  const url = parsed.toString();

  let strategy: ImportStrategy = "none";
  let rows: ImportRow[] = [];

  // 1. Platform JSON — exact, free, bypasses storefront bot protection.
  rows = await tryShopify(origin);
  if (rows.length) strategy = "shopify";

  if (!rows.length) {
    rows = await tryWooCommerce(origin);
    if (rows.length) strategy = "woocommerce";
  }

  // 2/3. One HTML fetch → JSON-LD, then LLM over the visible text.
  if (!rows.length) {
    const res = await timedFetch(url);
    const html = res && res.ok ? await res.text().catch(() => "") : "";
    if (html) {
      rows = extractJsonLd(html, url);
      if (rows.length) strategy = "json-ld";
      if (!rows.length) {
        rows = await groqExtract(htmlToMarkdownish(html, url), url);
        if (rows.length) strategy = "fetch-llm";
      }
    }
  }

  // 4. Firecrawl (paid) — default proxy, then escalate to stealth for
  //    bot-protected sites. Only runs when the free paths found nothing.
  if (!rows.length) {
    rows = await tryFirecrawl(url, false);
    if (rows.length) strategy = "firecrawl";
    if (!rows.length) {
      rows = await tryFirecrawl(url, true); // stealth proxy for protected sites
      if (rows.length) strategy = "firecrawl";
    }
  }

  if (!rows.length) {
    return { strategy: "none", found: 0, imported: 0, skipped: [], warnings: [] };
  }

  const result = await importProducts(orgId, rows);
  return { strategy, found: rows.length, ...result };
}
