import { assertPublicUrl } from "@/server/net/ssrfGuard";
import { importProducts, type ImportRow, type ImportResult } from "@/server/catalog/products";

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

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
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
 *  token cap than the conversation engine's completeJson). Never invents. */
async function groqExtract(content: string): Promise<ImportRow[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];
  const clipped = content.slice(0, 16000);
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
            'You extract e-commerce products from a storefront page. Return ONLY JSON: {"products":[{"name":string,"price":string,"category":string,"description":string}]}. ' +
            "Only real purchasable products actually shown on the page. price is digits only (no currency symbol). If a field is unknown use an empty string. If there are no products return an empty array. Never invent products.",
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
      .map((p: { name: string; price?: string; category?: string; description?: string }) => ({
        name: p.name.trim(),
        price: p.price ?? "",
        category: p.category ?? "",
        description: p.description ?? "",
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
        imageUrl: images[0]?.src ? String(images[0].src) : "",
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
    rows.push({
      name: String(p.name),
      price: String(rawPrice / Math.pow(10, minor)),
      category: categories[0]?.name ? String(categories[0].name) : "",
      description: p.short_description ? stripHtml(String(p.short_description)).slice(0, 600) : "",
      imageUrl: images[0]?.src ? String(images[0].src) : "",
    });
  }
  return rows.slice(0, MAX_PRODUCTS);
}

// ─── strategy 2: JSON-LD from fetched HTML ───────────────────────────────

function extractJsonLd(html: string): ImportRow[] {
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
        rows.push({
          name: String(obj.name),
          price: String(price),
          brand: obj.brand ? String((obj.brand as Record<string, unknown>)?.name ?? obj.brand) : "",
          description: obj.description ? String(obj.description) : "",
          imageUrl: image ? String(image) : "",
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
  return groqExtract(md);
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
      rows = extractJsonLd(html);
      if (rows.length) strategy = "json-ld";
      if (!rows.length) {
        rows = await groqExtract(stripHtml(html));
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
