import type { CrawlPageType } from "@prisma/client";

/**
 * Deterministic page classifier — the FIRST and primary layer. The crawl
 * only escalates to LLM classification (cost, inconsistent) as a fallback
 * when this layer can't decide with confidence.
 *
 * Uses: URL structure, <title>, <h1>, breadcrumbs, <link rel="canonical">,
 * schema.org/JSON-LD microdata, OpenGraph, and meta descriptions.
 */

export interface ClassifyInput {
  url: string;
  title?: string;
  h1?: string;
  html?: string; // light regex on JSON-LD + meta — the fetch already happened
}

export interface ClassifyDecision {
  pageType: CrawlPageType;
  confidence: number; // 0-1
  signal: string; // which signal drove the decision (for audit)
}

const PRODUCT_URL = /\/(products?|p|item|product-page|pd|sku)\//i;
const CATEGORY_URL = /\/categor(y|ies)\/|\/collections\/|\/(shop|browse)\/([\w-]+)\/?$/i;
const BLOG_URL = /\/blog(\/|$)|\/news(\/|$)|(^|\/)(article|post)s?(\/|$)/i;
const FAQ_URL = /\/faq(\/|$)|\/help(\/|$)/i;

function hasJsonLd(html: string, type: string): boolean {
  // Lightweight: find @type occurrences inside application/ld+json blocks.
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  return blocks.some((b) => new RegExp(`"@type"\\s*:\\s*(["']?)${type}\\1`, "i").test(b));
}

function textOf(maybe?: string): string {
  return (maybe ?? "").toLowerCase();
}

/**
 * Classify a crawled page deterministically. `html` optional but strongly
 * recommended — without it, URL/title only (confidence lower).
 */
export function classify(input: ClassifyInput): ClassifyDecision {
  const url = input.url;
  const title = textOf(input.title);
  const h1 = textOf(input.h1);
  const html = input.html ?? "";
  const combined = `${title} ${h1}`;

  // Product signals — highest priority.
  if (input.html && hasJsonLd(html, "Product")) {
    return { pageType: "PRODUCT", confidence: 0.98, signal: "jsonld:Product" };
  }
  if (/\b(add\s+(to\s+)?(cart|bag|basket)|price|buy|shop now)\b/.test(combined) && /\d[\d,.]*\s?(₦|n|k|usd|ngn)/i.test(html)) {
    // "add to cart" + price present in body → product page
    return { pageType: "PRODUCT", confidence: 0.85, signal: "buy+price body" };
  }
  if (/^(products?|item|p)\b/.test(url.split("/").pop() ?? "")) {
    return { pageType: "PRODUCT", confidence: 0.8, signal: "url slug" };
  }
  if (PRODUCT_URL.test(url)) {
    return { pageType: "PRODUCT", confidence: 0.9, signal: "url:product" };
  }
  if (hasJsonLd(html, "BreadcrumbList") && /\bqty\b|\bsku\b|in stock|out of stock|availability/i.test(html)) {
    return { pageType: "PRODUCT", confidence: 0.7, signal: "breadcrumb+stock" };
  }

  // Category/collection.
  if (input.html && hasJsonLd(html, "ItemList")) {
    return { pageType: "CATEGORY", confidence: 0.85, signal: "jsonld:ItemList" };
  }
  if (CATEGORY_URL.test(url)) {
    return { pageType: "CATEGORY", confidence: 0.85, signal: "url:category" };
  }
  if (/view all|shop all|browse all|our (range|collection)/.test(combined)) {
    return { pageType: "CATEGORY", confidence: 0.6, signal: "title:browse-all" };
  }

  // Policy pages.
  if (/(shipping|delivery|returns?|refund|policies?|warranty|terms?\b|privacy|payment).*(policy|info|page)/.test(combined)) {
    return { pageType: "POLICY", confidence: 0.9, signal: "title:policy" };
  }
  if (/(^|\/)(shipping|returns|refund|warranty|privacy|terms|policies?)(\/|$)/.test(url)) {
    return { pageType: "POLICY", confidence: 0.8, signal: "url:policy" };
  }
  if (/captcha|security-verification|human verification/i.test(combined)) {
    return { pageType: "OTHER", confidence: 0.9, signal: "title:bot-wall" };
  }

  // FAQ/help.
  if (hasJsonLd(html, "FAQPage")) {
    return { pageType: "FAQ", confidence: 0.95, signal: "jsonld:FAQPage" };
  }
  if (FAQ_URL.test(url)) {
    return { pageType: "FAQ", confidence: 0.9, signal: "url:faq" };
  }
  if (/(faq|frequently asked|help center|how can we help)/.test(combined)) {
    return { pageType: "FAQ", confidence: 0.75, signal: "title:faq" };
  }

  // About/contact.
  if (/(^|\/)(about|about-us|our-story)(\/|$)/.test(url) || /\babout us\b|our story/.test(combined)) {
    return { pageType: "ABOUT", confidence: 0.85, signal: "url/title:about" };
  }
  if (/(^|\/)(contact|contact-us)(\/|$)/.test(url) || /\bcontact us\b|get in touch/.test(combined)) {
    return { pageType: "CONTACT", confidence: 0.85, signal: "url/title:contact" };
  }

  // Blog.
  if (BLOG_URL.test(url) || /\bblog\b|\bnews\b/.test(combined)) {
    return { pageType: "BLOG", confidence: 0.8, signal: "url/title:blog" };
  }

  // Homepage.
  const urlPath = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  })();
  if (urlPath === "/" || urlPath === "") {
    if (combined) {
      return { pageType: "CATEGORY", confidence: 0.4, signal: "homepage-pivot" };
    }
    return { pageType: "OTHER", confidence: 0.3, signal: "homepage-blank" };
  }

  return { pageType: "OTHER", confidence: 0.5, signal: "no-signal" };
}