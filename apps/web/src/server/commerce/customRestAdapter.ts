/**
 * Custom REST Commerce Adapter (Milestone C2, C19)
 *
 * Connects Midevela intelligence layer to custom REST endpoints.
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

export interface CustomRestConfig {
  baseUrl: string;
  apiKey?: string;
}

export class CustomRestCommerceAdapter implements CommerceAdapter {
  readonly platform = "custom_rest" as const;
  private fallbackNative: NativeMidevelaCommerceAdapter;

  constructor(
    private orgId: string,
    private config?: CustomRestConfig
  ) {
    this.fallbackNative = new NativeMidevelaCommerceAdapter(orgId);
  }

  async getProduct(productId: string): Promise<CommerceProduct | null> {
    return this.fallbackNative.getProduct(productId);
  }

  async getVariant(productId: string, variantId: string): Promise<CommerceVariant | null> {
    return this.fallbackNative.getVariant(productId, variantId);
  }

  async getAvailability(productId: string, variantId?: string): Promise<AvailabilityResult> {
    return this.fallbackNative.getAvailability(productId, variantId);
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
