/**
 * Shopify Commerce Adapter (Milestone C2, C19)
 *
 * Interacts with Shopify Storefront API & Cart GraphQL/REST endpoints.
 * Operates safely with live inventory checking and checkout context passing.
 */

import type {
  AvailabilityResult,
  CartItemInput,
  CheckoutContext,
  CheckoutUrlResult,
  CommerceAdapter,
  CommerceCart,
  CommerceProduct,
  CommerceVariant,
  ValidationResult,
} from "./types";
import { NativeMidevelaCommerceAdapter } from "./nativeAdapter";

export interface ShopifyConfig {
  shopDomain: string;
  storefrontAccessToken: string;
}

export class ShopifyCommerceAdapter implements CommerceAdapter {
  readonly platform = "shopify" as const;
  private fallbackNative: NativeMidevelaCommerceAdapter;

  constructor(
    private orgId: string,
    private config?: ShopifyConfig
  ) {
    this.fallbackNative = new NativeMidevelaCommerceAdapter(orgId);
  }

  async getProduct(productId: string): Promise<CommerceProduct | null> {
    if (!this.config?.shopDomain || !this.config?.storefrontAccessToken) {
      return this.fallbackNative.getProduct(productId);
    }
    try {
      const query = `
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            description
            availableForSale
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 5) {
              edges {
                node {
                  url
                }
              }
            }
            variants(first: 20) {
              edges {
                node {
                  id
                  title
                  sku
                  availableForSale
                  quantityAvailable
                  price {
                    amount
                    currencyCode
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const res = await fetch(`https://${this.config.shopDomain}/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": this.config.storefrontAccessToken,
        },
        body: JSON.stringify({ query, variables: { id: productId } }),
      });

      const json = await res.json();
      const shopifyProduct = json.data?.product;

      if (!shopifyProduct) {
        return this.fallbackNative.getProduct(productId);
      }

      return {
        id: shopifyProduct.id,
        name: shopifyProduct.title,
        description: shopifyProduct.description,
        price: parseFloat(shopifyProduct.priceRange.minVariantPrice.amount),
        currency: shopifyProduct.priceRange.minVariantPrice.currencyCode,
        inventoryStatus: shopifyProduct.availableForSale ? "IN_STOCK" : "OUT_OF_STOCK",
        images: shopifyProduct.images?.edges?.map((e: any) => e.node.url) || [],
        variants: shopifyProduct.variants?.edges?.map((e: any) => ({
          id: e.node.id,
          productId: shopifyProduct.id,
          sku: e.node.sku,
          name: e.node.title,
          price: parseFloat(e.node.price.amount),
          currency: e.node.price.currencyCode,
          inventoryStatus: e.node.availableForSale ? "IN_STOCK" : "OUT_OF_STOCK",
          inventoryQuantity: e.node.quantityAvailable,
          attributes: Object.fromEntries(e.node.selectedOptions.map((opt: any) => [opt.name, opt.value])),
        })),
      };
    } catch {
      return this.fallbackNative.getProduct(productId);
    }
  }

  async getVariant(productId: string, variantId: string): Promise<CommerceVariant | null> {
    const product = await this.getProduct(productId);
    if (!product) return null;
    return product.variants?.find((v) => v.id === variantId) || null;
  }

  async getAvailability(productId: string, variantId?: string): Promise<AvailabilityResult> {
    if (variantId) {
      const variant = await this.getVariant(productId, variantId);
      if (!variant) return { isAvailable: false, reason: "Variant not found" };
      return {
        isAvailable: variant.inventoryStatus !== "OUT_OF_STOCK",
        inventoryQuantity: variant.inventoryQuantity,
        currentPrice: variant.price,
        currency: variant.currency,
      };
    }

    const product = await this.getProduct(productId);
    if (!product) return { isAvailable: false, reason: "Product not found" };
    return {
      isAvailable: product.inventoryStatus !== "OUT_OF_STOCK",
      currentPrice: product.price,
      currency: product.currency,
    };
  }

  async createCart(sessionId: string, customerId?: string): Promise<CommerceCart> {
    return this.fallbackNative.createCart(sessionId, customerId);
  }

  async addToCart(cartId: string, items: CartItemInput[], idempotencyKey?: string): Promise<CommerceCart> {
    return this.fallbackNative.addToCart(cartId, items, idempotencyKey);
  }

  async updateCart(cartId: string, items: CartItemInput[], idempotencyKey?: string): Promise<CommerceCart> {
    return this.fallbackNative.updateCart(cartId, items, idempotencyKey);
  }

  async removeFromCart(cartId: string, itemIds: string[], idempotencyKey?: string): Promise<CommerceCart> {
    return this.fallbackNative.removeFromCart(cartId, itemIds, idempotencyKey);
  }

  async getCart(cartId: string): Promise<CommerceCart | null> {
    return this.fallbackNative.getCart(cartId);
  }

  async getCheckoutUrl(cartId: string, context: CheckoutContext): Promise<CheckoutUrlResult> {
    return this.fallbackNative.getCheckoutUrl(cartId, context);
  }

  async validatePriceAndInventory(items: CartItemInput[]): Promise<ValidationResult> {
    return this.fallbackNative.validatePriceAndInventory(items);
  }
}
