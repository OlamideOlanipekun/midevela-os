import { describe, it, expect } from "vitest";
import { extractProductFromJsonLd } from "../product";

describe("Product Truth — Deterministic Extraction", () => {
  it("extracts all product truth fields from JSON-LD schema.org/Product without LLM invention", () => {
    const jsonLd = [
      {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": "Leather Chelsea Boots",
        "image": [
          "https://mystore.com/cdn/boots-1.jpg",
          "https://mystore.com/cdn/boots-2.jpg"
        ],
        "description": "Handcrafted genuine leather boots with elastic side panels.",
        "sku": "BOOT-CHE-001",
        "brand": {
          "@type": "Brand",
          "name": "Artisan Footwear"
        },
        "category": "Men's Shoes",
        "size": ["41", "42", "43"],
        "color": ["Chestnut Brown"],
        "offers": {
          "@type": "Offer",
          "price": "45000",
          "highPrice": "60000",
          "priceCurrency": "NGN",
          "availability": "https://schema.org/InStock",
          "url": "https://mystore.com/products/leather-chelsea-boots"
        },
        "hasVariant": [
          {
            "@type": "Product",
            "name": "Leather Chelsea Boots - Size 41",
            "sku": "BOOT-CHE-001-41",
            "size": "41",
            "color": "Chestnut Brown",
            "offers": {
              "@type": "Offer",
              "price": "45000",
              "availability": "https://schema.org/InStock"
            }
          },
          {
            "@type": "Product",
            "name": "Leather Chelsea Boots - Size 42",
            "sku": "BOOT-CHE-001-42",
            "size": "42",
            "color": "Chestnut Brown",
            "offers": {
              "@type": "Offer",
              "price": "45000",
              "availability": "https://schema.org/OutOfStock"
            }
          }
        ]
      }
    ];

    const extracted = extractProductFromJsonLd(jsonLd, "https://mystore.com/products/leather-chelsea-boots");

    expect(extracted).not.toBeNull();
    expect(extracted?.name).toBe("Leather Chelsea Boots");
    expect(extracted?.description).toContain("Handcrafted genuine leather boots");
    expect(extracted?.price).toBe(45000);
    expect(extracted?.compareAtPrice).toBe(60000);
    expect(extracted?.currency).toBe("NGN");
    expect(extracted?.sku).toBe("BOOT-CHE-001");
    expect(extracted?.brand).toBe("Artisan Footwear");
    expect(extracted?.category).toBe("Men's Shoes");
    expect(extracted?.availability).toBe("InStock");
    expect(extracted?.size).toEqual(["41", "42", "43"]);
    expect(extracted?.color).toEqual(["Chestnut Brown"]);
    expect(extracted?.images).toEqual([
      "https://mystore.com/cdn/boots-1.jpg",
      "https://mystore.com/cdn/boots-2.jpg"
    ]);

    expect(extracted?.variants?.length).toBe(2);
    expect(extracted?.variants?.[0].sku).toBe("BOOT-CHE-001-41");
    expect(extracted?.variants?.[0].inStock).toBe(true);
    expect(extracted?.variants?.[1].sku).toBe("BOOT-CHE-001-42");
    expect(extracted?.variants?.[1].inStock).toBe(false);
  });
});
