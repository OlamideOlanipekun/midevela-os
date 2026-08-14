/**
 * Universal Commerce Adapter Definitions (Milestone C2)
 *
 * Provides a platform-agnostic abstraction for Shopify, WooCommerce,
 * Custom REST, and Midevela Native commerce backends.
 */

export interface CommerceVariant {
  id: string;
  productId: string;
  sku?: string;
  name?: string;
  price: number;
  currency: string;
  inventoryStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  inventoryQuantity?: number;
  attributes: Record<string, string>;
  images?: string[];
  sourceUrl?: string;
}

export interface CommerceProduct {
  id: string;
  name: string;
  brand?: string;
  description?: string;
  price: number;
  currency: string;
  inventoryStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  sourceUrl?: string;
  images?: string[];
  attributes?: Record<string, unknown>;
  variants?: CommerceVariant[];
}

export interface CartItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface CommerceCartItem {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metadata?: Record<string, unknown>;
}

export interface CommerceCart {
  id: string;
  sessionId: string;
  externalCartId?: string;
  status: "ACTIVE" | "CHECKOUT_STARTED" | "COMPLETED" | "ABANDONED" | "EXPIRED";
  currency: string;
  totalAmount: number;
  items: CommerceCartItem[];
  metadata?: Record<string, unknown>;
}

export interface AvailabilityResult {
  isAvailable: boolean;
  inventoryQuantity?: number;
  reason?: string;
  currentPrice?: number;
  currency?: string;
}

export interface ItemValidation {
  productId: string;
  variantId?: string;
  requestedQuantity: number;
  availableQuantity?: number;
  isValid: boolean;
  priceMatches: boolean;
  currentPrice?: number;
  reason?: string;
}

export interface ValidationResult {
  isValid: boolean;
  items: ItemValidation[];
  errors: string[];
}

export interface CheckoutContext {
  sessionId: string;
  conversationId?: string;
  merchantId: string;
  customerId?: string;
  callbackUrl?: string;
}

export interface CheckoutUrlResult {
  checkoutUrl: string;
  isNativePaystack?: boolean;
  cartId: string;
  totalAmount: number;
  currency: string;
}

export interface CommerceAdapter {
  platform: "shopify" | "woocommerce" | "custom_rest" | "native";

  getProduct(productId: string): Promise<CommerceProduct | null>;
  getVariant(productId: string, variantId: string): Promise<CommerceVariant | null>;
  getAvailability(productId: string, variantId?: string): Promise<AvailabilityResult>;

  createCart(sessionId: string, customerId?: string): Promise<CommerceCart>;
  addToCart(cartId: string, items: CartItemInput[], idempotencyKey?: string): Promise<CommerceCart>;
  updateCart(cartId: string, items: CartItemInput[], idempotencyKey?: string): Promise<CommerceCart>;
  removeFromCart(cartId: string, itemIds: string[], idempotencyKey?: string): Promise<CommerceCart>;
  getCart(cartId: string): Promise<CommerceCart | null>;

  getCheckoutUrl(cartId: string, context: CheckoutContext): Promise<CheckoutUrlResult>;
  validatePriceAndInventory(items: CartItemInput[]): Promise<ValidationResult>;
}
