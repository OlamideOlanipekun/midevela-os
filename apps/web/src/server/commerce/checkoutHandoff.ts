/**
 * Checkout Handoff & Context Preservation (Milestone C7, C8)
 *
 * Validates cart availability/pricing and builds merchant checkout URL
 * preserving attribution context (`midevela_session_id`, `conversation_id`, `merchant_id`, `cart_id`).
 */

import { getCommerceAdapter } from "./factory";
import type { CheckoutContext, CheckoutUrlResult } from "./types";

export class CheckoutHandoffEngine {
  static async prepareCheckout(
    orgId: string,
    cartId: string,
    context: CheckoutContext
  ): Promise<CheckoutUrlResult> {
    const adapter = await getCommerceAdapter(orgId);

    // 1. Get active cart
    const cart = await adapter.getCart(cartId);
    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty or does not exist");
    }

    // 2. Validate price & inventory prior to checkout (C14)
    const cartItemInputs = cart.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    const validation = await adapter.validatePriceAndInventory(cartItemInputs);
    if (!validation.isValid) {
      throw new Error(`Checkout validation failed: ${validation.errors.join(", ")}`);
    }

    // 3. Obtain Checkout URL with attribution parameters preserved (C8)
    return adapter.getCheckoutUrl(cartId, context);
  }
}
