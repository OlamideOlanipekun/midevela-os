import { describe, it, expect } from "vitest";
import { discoverLinks, declaredCanonical } from "../discovery";
import { urlDigest, effectiveHost, canonicalUrlFor } from "../canonical";

describe("Crawler Reliability — Link Discovery & Prioritization", () => {
  it("prioritizes product, category, policy, and pagination URLs over generic links", () => {
    const html = `
      <html>
        <body>
          <a href="/products/nike-air-max">Nike Air Max</a>
          <a href="/collections/footwear">Footwear Collection</a>
          <a href="/policies/refund-policy">Refund Policy</a>
          <a href="/collections/footwear?page=2" rel="next">Next Page</a>
          <a href="/about-our-team">About Team</a>
        </body>
      </html>
    `;

    const links = discoverLinks(html, "https://mystore.com", { seedHost: "mystore.com" });
    expect(links.length).toBe(5);

    // Sorted descending by priority
    expect(links[0].url).toContain("/products/nike-air-max");
    expect(links[0].priority).toBe(95);

    const categoryLink = links.find((l) => l.url.includes("/collections/footwear") && !l.url.includes("page=2"));
    expect(categoryLink?.priority).toBe(90);

    const policyLink = links.find((l) => l.url.includes("/policies/refund-policy"));
    expect(policyLink?.priority).toBe(90);

    const paginationLink = links.find((l) => l.url.includes("page=2"));
    expect(paginationLink?.priority).toBe(85);

    const genericLink = links.find((l) => l.url.includes("/about-our-team"));
    expect(genericLink?.priority).toBe(50);
  });

  it("extracts declared canonical link", () => {
    const html = `
      <html>
        <head>
          <link rel="canonical" href="https://mystore.com/products/canonical-item" />
        </head>
      </html>
    `;
    const canonical = declaredCanonical(html, "https://mystore.com/products/canonical-item?ref=123");
    expect(canonical).not.toBeNull();
    expect(canonical?.url).toBe("https://mystore.com/products/canonical-item");
  });
});

describe("Crawler Reliability — URL Normalization & Deduplication", () => {
  it("strips tracking parameters while preserving real query params", () => {
    const raw = "https://MyStore.com:443/products/shirt/?utm_source=google&fbclid=xyz&color=blue&size=m#section1";
    const digest = urlDigest(raw);
    expect(digest).toBe("https://mystore.com/products/shirt?color=blue&size=m");
  });

  it("normalizes trailing slash and default ports", () => {
    const url1 = "HTTP://mystore.com:80/products/shoes/";
    const url2 = "https://mystore.com:443/products/shoes";
    expect(urlDigest(url1)).toBe("http://mystore.com/products/shoes");
    expect(urlDigest(url2)).toBe("https://mystore.com/products/shoes");
  });

  it("uses declared canonical when on same host", () => {
    const actual = "https://mystore.com/products/shoes?variant=123";
    const declared = "https://mystore.com/products/shoes";
    const key = canonicalUrlFor(actual, declared);
    expect(key).toBe("https://mystore.com/products/shoes");
  });

  it("ignores cross-domain declared canonical", () => {
    const actual = "https://mystore.com/products/shoes";
    const declared = "https://evil.com/products/shoes";
    const key = canonicalUrlFor(actual, declared);
    expect(key).toBe("https://mystore.com/products/shoes");
  });
});
