import type { Prisma } from "@prisma/client";

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
  EUR: "€",
};

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "₦": "NGN",
  $: "USD",
  "£": "GBP",
  "€": "EUR",
};

export function formatMoney(amount: Prisma.Decimal | number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Number(amount).toLocaleString()}`;
}

/**
 * Normalizes a currency hint from an untrusted source (LLM output, JSON-LD,
 * a merchant's platform API) into a known ISO code, or null if it isn't one
 * we recognize. Accepts either an ISO code ("USD") or a bare symbol ("$")
 * since LLM extraction sometimes returns the symbol instead of the code.
 */
export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper in CURRENCY_SYMBOLS) return upper;
  if (trimmed in SYMBOL_TO_CURRENCY) return SYMBOL_TO_CURRENCY[trimmed];
  return null;
}
