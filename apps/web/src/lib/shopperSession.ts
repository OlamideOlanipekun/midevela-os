/**
 * Midevela Shopper Session Manager — Milestone A (A2 + A10)
 *
 * Tracks anonymous shopper state client-side across a merchant session.
 * Stored in sessionStorage (tab-scoped) with a durable visitor ID in
 * localStorage. Never stores personally identifiable information.
 *
 * The session object is the single source of truth for:
 *   • session_id         — ephemeral tab-scoped ID
 *   • merchant_id        — resolved from the widget key
 *   • entry_page         — URL where the shopper first opened the widget
 *   • current_page       — current window.location.href
 *   • products_viewed    — product IDs shown or clicked
 *   • searches           — raw search queries typed
 *   • queries            — raw conversational queries
 *   • clicks             — product/link clicks logged
 *   • cart_state         — items the shopper expressed intent to add
 *   • conversation_state — last-known AI conversation mode + constraints
 *   • intent             — last classified intent from the AI response
 */

export type CartItem = {
  productId: string;
  name: string;
  price: string;
  currency: string;
  imageUrl?: string;
  sourceUrl?: string;
  quantity: number;
};

export type ConversationConstraints = {
  categoryId?: string;
  categoryName?: string;
  budgetMin?: number;
  budgetMax?: number;
  brand?: string;
  attributes?: Record<string, string>;
};

export type ShopperSession = {
  sessionId: string;
  visitorId: string;   // durable across tabs (localStorage)
  merchantId: string;  // orgId resolved by init endpoint
  entryPage: string;
  currentPage: string;
  productsViewed: string[];
  searches: string[];
  queries: string[];
  clicks: Array<{ productId: string; ts: number }>;
  cartState: CartItem[];
  conversationConstraints: ConversationConstraints;
  intent: string;
  startedAt: number;
  lastActivityAt: number;
};

const SESSION_KEY = "mv_session";
const VISITOR_KEY = "mv_visitor_id";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes idle

// ─── Visitor ID (durable) ─────────────────────────────────────────────────────

function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = "visitor-" + crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "visitor-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
}

// ─── Session (tab-scoped) ─────────────────────────────────────────────────────

function makeSessionId(): string {
  return "sess-" + crypto.randomUUID();
}

function isExpired(session: ShopperSession): boolean {
  return Date.now() - session.lastActivityAt > SESSION_TTL_MS;
}

function readSession(): ShopperSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: ShopperSession = JSON.parse(raw);
    if (isExpired(parsed)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: ShopperSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage quota exceeded or blocked — continue silently
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get-or-create the current session.
 * Call on widget open or page load.
 */
export function getOrCreateSession(merchantId: string): ShopperSession {
  const existing = readSession();
  if (existing && existing.merchantId === merchantId) {
    // Bump activity timestamp
    const refreshed = { ...existing, currentPage: currentHref(), lastActivityAt: Date.now() };
    writeSession(refreshed);
    return refreshed;
  }

  // New session (first open, expired, or different merchant)
  const href = currentHref();
  const session: ShopperSession = {
    sessionId: makeSessionId(),
    visitorId: getOrCreateVisitorId(),
    merchantId,
    entryPage: href,
    currentPage: href,
    productsViewed: [],
    searches: [],
    queries: [],
    clicks: [],
    cartState: [],
    conversationConstraints: {},
    intent: "unknown",
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  writeSession(session);
  return session;
}

/**
 * Record that the shopper navigated to a new page on the merchant's site.
 * Call on popstate / hashchange / SPA route change.
 */
export function recordPageView(url: string): ShopperSession {
  const session = getActiveSession();
  const updated = { ...session, currentPage: url, lastActivityAt: Date.now() };
  writeSession(updated);
  return updated;
}

/**
 * Record a product the AI showed to the shopper.
 */
export function recordProductViewed(productId: string): ShopperSession {
  const session = getActiveSession();
  const productsViewed = session.productsViewed.includes(productId)
    ? session.productsViewed
    : [...session.productsViewed.slice(-49), productId]; // cap at 50
  const updated = { ...session, productsViewed, lastActivityAt: Date.now() };
  writeSession(updated);
  return updated;
}

/**
 * Record a product click (View Product / Add to Cart).
 */
export function recordProductClick(productId: string): ShopperSession {
  const session = getActiveSession();
  const clicks = [...session.clicks, { productId, ts: Date.now() }].slice(-50);
  const updated = { ...session, clicks, lastActivityAt: Date.now() };
  writeSession(updated);
  return updated;
}

/**
 * Record a shopper's search / conversational query.
 */
export function recordQuery(text: string): ShopperSession {
  const session = getActiveSession();
  const queries = [...session.queries.slice(-29), text];
  const updated = { ...session, queries, lastActivityAt: Date.now() };
  writeSession(updated);
  return updated;
}

/**
 * Record a search/filter keyword.
 */
export function recordSearch(query: string): ShopperSession {
  const session = getActiveSession();
  const searches = [...session.searches.slice(-19), query];
  const updated = { ...session, searches, lastActivityAt: Date.now() };
  writeSession(updated);
  return updated;
}

/**
 * Add or update a cart item (no quantity yet — Milestone A tracks intent only).
 */
export function addToCartState(item: Omit<CartItem, "quantity">): ShopperSession {
  const session = getActiveSession();
  const existing = session.cartState.find((i) => i.productId === item.productId);
  const cartState = existing
    ? session.cartState.map((i) => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i)
    : [...session.cartState, { ...item, quantity: 1 }];
  const updated = { ...session, cartState, lastActivityAt: Date.now() };
  writeSession(updated);
  return updated;
}

/**
 * Update the shopper's resolved AI conversation constraints
 * (category, budget, brand) from a chat API response.
 */
export function updateConversationConstraints(constraints: Partial<ConversationConstraints>): ShopperSession {
  const session = getActiveSession();
  const updated = {
    ...session,
    conversationConstraints: { ...session.conversationConstraints, ...constraints },
    lastActivityAt: Date.now(),
  };
  writeSession(updated);
  return updated;
}

/**
 * Update the shopper's last known intent from an AI response.
 */
export function updateIntent(intent: string): ShopperSession {
  const session = getActiveSession();
  const updated = { ...session, intent, lastActivityAt: Date.now() };
  writeSession(updated);
  return updated;
}

/**
 * Returns the session object without creating a new one.
 * Throws if no session exists — callers should always `getOrCreateSession` first.
 */
export function getActiveSession(): ShopperSession {
  const session = readSession();
  if (!session) {
    // Shouldn't happen in normal flow — but safe fallback
    return getOrCreateSession("unknown");
  }
  return session;
}

/**
 * Explicit session end (widget closed, user-triggered reset).
 */
export function endSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Returns a minimal context payload to include in chat API requests. */
export function sessionContext(session: ShopperSession): {
  sessionId: string;
  visitorId: string;
  currentPage: string;
  recentProducts: string[];
  constraints: ConversationConstraints;
  cartItemCount: number;
} {
  return {
    sessionId: session.sessionId,
    visitorId: session.visitorId,
    currentPage: session.currentPage,
    recentProducts: session.productsViewed.slice(-5),
    constraints: session.conversationConstraints,
    cartItemCount: session.cartState.reduce((sum, i) => sum + i.quantity, 0),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentHref(): string {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

/** Typed Milestone A analytics event names */
export type AnalyticsEventType =
  | "SESSION_STARTED"
  | "PAGE_VIEWED"
  | "SEARCH_PERFORMED"
  | "PRODUCT_VIEWED"
  | "PRODUCT_CLICKED"
  | "PRODUCT_ADDED_TO_CART"
  | "NAVIGATION_REQUESTED"
  | "CHECKOUT_STARTED";
