/**
 * Cart Engine (Milestone C3, C4, C5, C14, C17, C18)
 *
 * Coordinates real commerce cart operations, variant resolution, live validation,
 * safety checks, idempotency, and conversational cart intelligence.
 */

import { getCommerceAdapter } from "./factory";
import { CommerceSafetyLayer } from "./safetyLayer";
import { IdempotencyManager } from "./idempotency";
import { resolveVariant, type VariantSelection } from "@/server/widget/variantEngine";
import type { CartItemInput, CommerceCart, ValidationResult } from "./types";

export interface AddToCartRequest {
  orgId: string;
  sessionId: string;
  cartId?: string;
  productId: string;
  variantSelection?: VariantSelection;
  quantity?: number;
  idempotencyKey?: string;
}

export interface AddToCartResponse {
  success: boolean;
  cart?: CommerceCart;
  addedItem?: {
    productName: string;
    variantName?: string;
    quantity: number;
    price: number;
  };
  errorMessage?: string;
}

export class CartEngine {
  /**
   * Gets or creates active cart for session.
   */
  static async getOrCreateCart(orgId: string, sessionId: string, customerId?: string): Promise<CommerceCart> {
    const adapter = await getCommerceAdapter(orgId);
    return adapter.createCart(sessionId, customerId);
  }

  /**
   * Executes Add to Cart against merchant system.
   * Only claims success AFTER commerce platform confirms API operation.
   */
  static async addToCart(req: AddToCartRequest): Promise<AddToCartResponse> {
    const qty = req.quantity ?? 1;

    // 1. Safety Layer Authorization (C17)
    const safetyCheck = CommerceSafetyLayer.authorizeAction({
      actionType: "ADD_TO_CART",
      orgId: req.orgId,
      sessionId: req.sessionId,
      productId: req.productId,
      quantity: qty,
    });
    if (!safetyCheck.authorized) {
      return { success: false, errorMessage: safetyCheck.reason || "Action unauthorized" };
    }

    const adapter = await getCommerceAdapter(req.orgId);

    // 2. Variant Resolution (C4)
    let selectedVariantId: string | undefined;
    if (req.variantSelection && (req.variantSelection.size || req.variantSelection.color || req.variantSelection.attributes)) {
      const variantRes = await resolveVariant(req.productId, req.orgId, req.variantSelection);
      if (!variantRes.resolved || !variantRes.variant) {
        return {
          success: false,
          errorMessage: variantRes.message || "Requested variant is not available",
        };
      }
      selectedVariantId = variantRes.variant.id;
    }

    // 3. Live Price & Inventory Validation (C14)
    const itemInput: CartItemInput = {
      productId: req.productId,
      variantId: selectedVariantId,
      quantity: safetyCheck.sanitizedQuantity ?? qty,
    };

    const validation: ValidationResult = await adapter.validatePriceAndInventory([itemInput]);
    if (!validation.isValid) {
      return {
        success: false,
        errorMessage: validation.errors.join("; ") || "Item failed availability validation",
      };
    }

    // 4. Ensure Cart Exists
    const cart = req.cartId
      ? (await adapter.getCart(req.cartId)) || (await adapter.createCart(req.sessionId))
      : await adapter.createCart(req.sessionId);

    // 5. Idempotency Execution (C18)
    const ik = req.idempotencyKey || IdempotencyManager.generateKey(req.sessionId, "ADD_TO_CART", {
      cartId: cart.id,
      productId: req.productId,
      variantId: selectedVariantId,
      quantity: itemInput.quantity,
    });

    try {
      const updatedCart = await IdempotencyManager.executeIdempotent(ik, async () => {
        return adapter.addToCart(cart.id, [itemInput], ik);
      });

      const product = await adapter.getProduct(req.productId);
      const variant = selectedVariantId ? await adapter.getVariant(req.productId, selectedVariantId) : null;

      return {
        success: true,
        cart: updatedCart,
        addedItem: {
          productName: product?.name || "Product",
          variantName: variant?.name || (variant ? Object.values(variant.attributes).join(" / ") : undefined),
          quantity: itemInput.quantity,
          price: variant ? variant.price : (product?.price || 0),
        },
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage: err.message || "Commerce API error adding item to cart",
      };
    }
  }

  /**
   * Cart State Intelligence & Summary (C5).
   */
  static async getCartSummary(orgId: string, cartId: string): Promise<string> {
    const adapter = await getCommerceAdapter(orgId);
    const cart = await adapter.getCart(cartId);

    if (!cart || cart.items.length === 0) {
      return "Your cart is currently empty.";
    }

    const itemLines = cart.items.map((item, idx) => {
      const variantInfo = item.metadata?.variantName ? ` (${item.metadata.variantName})` : "";
      return `${idx + 1}. ${item.productName}${variantInfo} x${item.quantity} — ${cart.currency} ${item.totalPrice.toLocaleString()}`;
    });

    return `Your Cart (${cart.items.length} items):\n${itemLines.join("\n")}\n\nTotal: ${cart.currency} ${cart.totalAmount.toLocaleString()}`;
  }

  /**
   * Removes item from cart (C5).
   */
  static async removeFromCart(orgId: string, cartId: string, itemId: string): Promise<CommerceCart> {
    const adapter = await getCommerceAdapter(orgId);
    return adapter.removeFromCart(cartId, [itemId]);
  }
}
