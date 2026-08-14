/**
 * Commerce Safety Layer (Milestone C17)
 *
 * Deterministic authorization & validation layer for all commerce API actions.
 * Protects against unrestricted LLM tool execution and malicious/unbounded requests.
 */

export interface ActionProposal {
  actionType: "ADD_TO_CART" | "UPDATE_QUANTITY" | "REMOVE_FROM_CART" | "CHECKOUT" | "CLEAR_CART";
  productId?: string;
  variantId?: string;
  quantity?: number;
  cartId?: string;
  sessionId: string;
  orgId: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  sanitizedQuantity?: number;
}

export class CommerceSafetyLayer {
  private static MAX_SINGLE_ITEM_QUANTITY = 50;
  private static MAX_CART_TOTAL_ITEMS = 200;

  /**
   * Validates and authorizes an action proposal deterministically before calling Commerce API.
   */
  static authorizeAction(proposal: ActionProposal): AuthorizationResult {
    if (!proposal.sessionId || !proposal.orgId) {
      return { authorized: false, reason: "Missing tenant or session identity" };
    }

    if (proposal.actionType === "ADD_TO_CART" || proposal.actionType === "UPDATE_QUANTITY") {
      if (!proposal.productId) {
        return { authorized: false, reason: "Missing target product" };
      }

      const qty = proposal.quantity ?? 1;
      if (isNaN(qty) || qty <= 0) {
        return { authorized: false, reason: "Invalid quantity requested" };
      }

      if (qty > this.MAX_SINGLE_ITEM_QUANTITY) {
        return {
          authorized: false,
          reason: `Quantity ${qty} exceeds max allowed per item (${this.MAX_SINGLE_ITEM_QUANTITY})`,
        };
      }

      return {
        authorized: true,
        sanitizedQuantity: qty,
      };
    }

    if (proposal.actionType === "REMOVE_FROM_CART") {
      if (!proposal.productId && !proposal.variantId) {
        return { authorized: false, reason: "Missing target item for removal" };
      }
      return { authorized: true };
    }

    if (proposal.actionType === "CHECKOUT" || proposal.actionType === "CLEAR_CART") {
      return { authorized: true };
    }

    return { authorized: false, reason: "Unsupported action type" };
  }
}
