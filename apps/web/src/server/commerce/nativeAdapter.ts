/**
 * Native Midevela Commerce Adapter (Milestone C2)
 *
 * Operates on Midevela catalog database (Prisma) and native payment links (Paystack / Store URL).
 */

import prisma from "@/lib/prisma";
import type {
  AvailabilityResult,
  CartItemInput,
  CheckoutContext,
  CheckoutUrlResult,
  CommerceAdapter,
  CommerceCart,
  CommerceCartItem,
  CommerceProduct,
  CommerceVariant,
  ValidationResult,
} from "./types";
import { generatePaymentLink } from "@/server/widget/checkoutHandler";

export class NativeMidevelaCommerceAdapter implements CommerceAdapter {
  readonly platform = "native" as const;

  constructor(private orgId: string) {}

  async getProduct(productId: string): Promise<CommerceProduct | null> {
    const product = await prisma.product.findFirst({
      where: { id: productId, orgId: this.orgId },
      include: { variants: true },
    });
    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      brand: product.brand || undefined,
      description: product.description || undefined,
      price: Number(product.price),
      currency: product.currency,
      inventoryStatus: product.inventoryStatus,
      sourceUrl: product.sourceUrl || undefined,
      images: Array.isArray(product.images) ? (product.images as string[]) : [],
      attributes: (product.attributes as Record<string, unknown>) || {},
      variants: product.variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku || undefined,
        name: v.name || undefined,
        price: v.price !== null ? Number(v.price) : Number(product.price),
        currency: v.currency || product.currency,
        inventoryStatus: v.inventoryStatus,
        inventoryQuantity: v.inventoryQuantity ?? undefined,
        attributes: (v.attributes as Record<string, string>) || {},
        images: Array.isArray(v.images) ? (v.images as string[]) : [],
        sourceUrl: v.sourceUrl || undefined,
      })),
    };
  }

  async getVariant(productId: string, variantId: string): Promise<CommerceVariant | null> {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId, orgId: this.orgId },
      include: { product: true },
    });
    if (!variant) return null;

    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku || undefined,
      name: variant.name || undefined,
      price: variant.price !== null ? Number(variant.price) : Number(variant.product.price),
      currency: variant.currency || variant.product.currency,
      inventoryStatus: variant.inventoryStatus,
      inventoryQuantity: variant.inventoryQuantity ?? undefined,
      attributes: (variant.attributes as Record<string, string>) || {},
      images: Array.isArray(variant.images) ? (variant.images as string[]) : [],
      sourceUrl: variant.sourceUrl || undefined,
    };
  }

  async getAvailability(productId: string, variantId?: string): Promise<AvailabilityResult> {
    if (variantId) {
      const variant = await this.getVariant(productId, variantId);
      if (!variant) return { isAvailable: false, reason: "Variant not found" };
      const isAvailable = variant.inventoryStatus !== "OUT_OF_STOCK" && (variant.inventoryQuantity === undefined || variant.inventoryQuantity > 0);
      return {
        isAvailable,
        inventoryQuantity: variant.inventoryQuantity,
        currentPrice: variant.price,
        currency: variant.currency,
        reason: isAvailable ? undefined : "Variant out of stock",
      };
    }

    const product = await this.getProduct(productId);
    if (!product) return { isAvailable: false, reason: "Product not found" };
    const isAvailable = product.inventoryStatus !== "OUT_OF_STOCK";
    return {
      isAvailable,
      currentPrice: product.price,
      currency: product.currency,
      reason: isAvailable ? undefined : "Product out of stock",
    };
  }

  async createCart(sessionId: string, customerId?: string): Promise<CommerceCart> {
    const cart = await prisma.cart.create({
      data: {
        orgId: this.orgId,
        sessionId,
        customerId: customerId || null,
        status: "ACTIVE",
        totalAmount: 0,
        currency: "NGN",
      },
      include: { items: true },
    });

    return this.mapCart(cart);
  }

  async addToCart(cartId: string, items: CartItemInput[], idempotencyKey?: string): Promise<CommerceCart> {
    const cart = await prisma.cart.findFirst({
      where: { id: cartId, orgId: this.orgId },
      include: { items: true },
    });
    if (!cart) throw new Error(`Cart ${cartId} not found`);

    for (const itemInput of items) {
      const availability = await this.getAvailability(itemInput.productId, itemInput.variantId);
      if (!availability.isAvailable) {
        throw new Error(`Product ${itemInput.productId} (variant: ${itemInput.variantId || "default"}) is unavailable: ${availability.reason}`);
      }

      let productName = "Product";
      let unitPrice = availability.currentPrice || 0;

      if (itemInput.variantId) {
        const variant = await this.getVariant(itemInput.productId, itemInput.variantId);
        if (variant) {
          productName = variant.name || "Product Variant";
          unitPrice = variant.price;
        }
      } else {
        const product = await this.getProduct(itemInput.productId);
        if (product) {
          productName = product.name;
          unitPrice = product.price;
        }
      }

      const existingItem = cart.items.find(
        (i) => i.productId === itemInput.productId && (i.variantId === (itemInput.variantId || null))
      );

      if (existingItem) {
        const newQty = existingItem.quantity + itemInput.quantity;
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQty,
            totalPrice: Number(existingItem.unitPrice) * newQty,
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: itemInput.productId,
            variantId: itemInput.variantId || null,
            productName,
            quantity: itemInput.quantity,
            unitPrice,
            totalPrice: unitPrice * itemInput.quantity,
            metadata: (itemInput.metadata as object) || {},
          },
        });
      }
    }

    return this.recalculateAndUpdateCart(cartId);
  }

  async updateCart(cartId: string, items: CartItemInput[], idempotencyKey?: string): Promise<CommerceCart> {
    const cart = await prisma.cart.findFirst({
      where: { id: cartId, orgId: this.orgId },
      include: { items: true },
    });
    if (!cart) throw new Error(`Cart ${cartId} not found`);

    for (const itemInput of items) {
      const existingItem = cart.items.find(
        (i) => i.productId === itemInput.productId && (i.variantId === (itemInput.variantId || null))
      );

      if (existingItem) {
        if (itemInput.quantity <= 0) {
          await prisma.cartItem.delete({ where: { id: existingItem.id } });
        } else {
          await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: itemInput.quantity,
              totalPrice: Number(existingItem.unitPrice) * itemInput.quantity,
            },
          });
        }
      }
    }

    return this.recalculateAndUpdateCart(cartId);
  }

  async removeFromCart(cartId: string, itemIds: string[], idempotencyKey?: string): Promise<CommerceCart> {
    await prisma.cartItem.deleteMany({
      where: {
        cartId,
        id: { in: itemIds },
      },
    });

    return this.recalculateAndUpdateCart(cartId);
  }

  async getCart(cartId: string): Promise<CommerceCart | null> {
    const cart = await prisma.cart.findFirst({
      where: { id: cartId, orgId: this.orgId },
      include: { items: true },
    });
    if (!cart) return null;
    return this.mapCart(cart);
  }

  async getCheckoutUrl(cartId: string, context: CheckoutContext): Promise<CheckoutUrlResult> {
    const cart = await this.getCart(cartId);
    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty or not found");
    }

    await prisma.cart.update({
      where: { id: cartId },
      data: {
        status: "CHECKOUT_STARTED",
        conversationId: context.conversationId || null,
      },
    });

    const firstItem = cart.items[0];
    const linkResult = await generatePaymentLink({
      productId: firstItem.productId,
      orgId: this.orgId,
      callbackUrl: context.callbackUrl,
    });

    let checkoutUrl = linkResult?.paymentUrl || "https://midevela.com/checkout/success";

    // Append preserved context query params (C8)
    const urlObj = new URL(checkoutUrl);
    urlObj.searchParams.set("midevela_session_id", context.sessionId);
    if (context.conversationId) urlObj.searchParams.set("midevela_conversation_id", context.conversationId);
    urlObj.searchParams.set("midevela_merchant_id", this.orgId);
    urlObj.searchParams.set("midevela_cart_id", cartId);

    return {
      checkoutUrl: urlObj.toString(),
      isNativePaystack: linkResult?.isPaystack ?? false,
      cartId,
      totalAmount: cart.totalAmount,
      currency: cart.currency,
    };
  }

  async validatePriceAndInventory(items: CartItemInput[]): Promise<ValidationResult> {
    const validations = [];
    const errors: string[] = [];
    let isValid = true;

    for (const item of items) {
      const availability = await this.getAvailability(item.productId, item.variantId);
      const isAvailable = availability.isAvailable;
      if (!isAvailable) {
        isValid = false;
        errors.push(`Item ${item.productId} unavailable: ${availability.reason}`);
      }

      validations.push({
        productId: item.productId,
        variantId: item.variantId,
        requestedQuantity: item.quantity,
        availableQuantity: availability.inventoryQuantity,
        isValid: isAvailable,
        priceMatches: true,
        currentPrice: availability.currentPrice,
        reason: availability.reason,
      });
    }

    return {
      isValid,
      items: validations,
      errors,
    };
  }

  private async recalculateAndUpdateCart(cartId: string): Promise<CommerceCart> {
    const updatedCart = await prisma.cart.findFirst({
      where: { id: cartId },
      include: { items: true },
    });
    if (!updatedCart) throw new Error(`Cart ${cartId} missing`);

    const totalAmount = updatedCart.items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const currency = updatedCart.items[0]?.unitPrice ? "NGN" : updatedCart.currency;

    const saved = await prisma.cart.update({
      where: { id: cartId },
      data: {
        totalAmount,
        currency,
      },
      include: { items: true },
    });

    return this.mapCart(saved);
  }

  private mapCart(cart: any): CommerceCart {
    return {
      id: cart.id,
      sessionId: cart.sessionId,
      externalCartId: cart.externalCartId || undefined,
      status: cart.status as CommerceCart["status"],
      currency: cart.currency,
      totalAmount: Number(cart.totalAmount),
      items: cart.items.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId || undefined,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        metadata: (i.metadata as Record<string, unknown>) || {},
      })),
      metadata: (cart.metadata as Record<string, unknown>) || {},
    };
  }
}
