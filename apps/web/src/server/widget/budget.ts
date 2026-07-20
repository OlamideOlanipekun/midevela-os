import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";
import type { QualificationOption } from "@/server/widget/qualificationTemplates";

const MIN_PRICES_FOR_DYNAMIC_BUDGET = 4;

/**
 * Rounds a boundary to a "clean" number a shopper would actually pick from
 * a budget chip — e.g. 473,500 -> 500,000; 68,200 -> 70,000; 1,240,000 ->
 * 1,200,000. Rounds to 1-2 significant figures, scaled to the number's
 * own magnitude, so both a ₦5,000 phone case and a ₦2,000,000 laptop get
 * sensibly-rounded buckets.
 */
function roundNice(n: number): number {
  if (n <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  // Two-significant-figure step below ~1000, one-significant-figure above -
  // keeps small-catalog buckets from being needlessly coarse.
  const step = n < 1000 ? magnitude / 10 : magnitude / 2;
  return Math.round(n / step) * step;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Computes budget qualification options from a category's REAL, in-stock
 * prices — rounded-quantile buckets (25th/50th/75th percentile boundaries),
 * so a phone-case shop and a laptop shop each get ranges that reflect what
 * they actually sell, in the merchant's real currency. Returns [] when
 * there isn't enough price variety to bucket meaningfully; the caller
 * falls back to the category's static template ranges in that case.
 */
export async function computeBudgetOptions(
  orgId: string,
  categoryIds: string[],
  currency: string
): Promise<QualificationOption[]> {
  const products = await prisma.product.findMany({
    where: { orgId, categoryId: { in: categoryIds }, inventoryStatus: { not: "OUT_OF_STOCK" } },
    select: { price: true, currency: true },
  });

  const prices = products.map((p) => Number(p.price)).filter((n) => Number.isFinite(n) && n > 0);
  const distinct = [...new Set(prices)].sort((a, b) => a - b);
  if (distinct.length < MIN_PRICES_FOR_DYNAMIC_BUDGET) return [];

  const boundaries = [percentile(distinct, 0.25), percentile(distinct, 0.5), percentile(distinct, 0.75)]
    .map(roundNice)
    .filter((n, i, arr) => n > 0 && arr.indexOf(n) === i) // dedupe rounded collisions
    .sort((a, b) => a - b);

  if (boundaries.length === 0) return [];

  // Derive dominant currency from products that actually set the price boundaries
  const activeProducts = products.filter((p) => Number.isFinite(Number(p.price)) && Number(p.price) > 0);
  const currencyCount = new Map<string, number>();
  let dominantCurrency = currency;
  let maxCount = 0;
  for (const p of activeProducts) {
    const c = p.currency ?? currency;
    const count = (currencyCount.get(c) ?? 0) + 1;
    currencyCount.set(c, count);
    if (count > maxCount) {
      maxCount = count;
      dominantCurrency = c;
    }
  }

  const options: QualificationOption[] = [];
  options.push({ label: `Under ${formatMoney(boundaries[0], dominantCurrency)}`, value: `0-${boundaries[0]}` });
  for (let i = 0; i < boundaries.length - 1; i++) {
    options.push({
      label: `${formatMoney(boundaries[i], dominantCurrency)} – ${formatMoney(boundaries[i + 1], dominantCurrency)}`,
      value: `${boundaries[i]}-${boundaries[i + 1]}`,
    });
  }
  const top = boundaries[boundaries.length - 1];
  options.push({ label: `${formatMoney(top, dominantCurrency)}+`, value: `${top}-` });

  return options;
}
