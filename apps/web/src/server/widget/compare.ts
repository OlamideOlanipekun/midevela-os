import prisma from "@/lib/prisma";
import type { Product } from "@prisma/client";
import { ApiError } from "@/server/http";
import { formatMoney } from "@/server/catalog/money";
import { completeJson, type ChatMessage } from "@/server/conversation/llm";

export interface CompareRow {
  label: string;
  /** Same order as CompareResult.products. */
  values: string[];
}

export interface CompareResult {
  products: Array<{ id: string; name: string; price: string }>;
  rows: CompareRow[];
  recommendation: string;
}

/**
 * Real, structured comparison rows from Product.attributes — trusted data,
 * never invented. Only returned for keys where at least one product has a
 * value (an all-empty column across both products isn't worth showing).
 */
function attributesFromRealData(products: Product[]): CompareRow[] {
  const keys = new Set<string>();
  for (const p of products) {
    const attrs = p.attributes;
    if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
      for (const k of Object.keys(attrs as Record<string, unknown>)) keys.add(k);
    }
  }
  const rows: CompareRow[] = [];
  for (const key of keys) {
    const values = products.map((p) => {
      const attrs = (p.attributes ?? {}) as Record<string, unknown>;
      const v = attrs[key];
      return v === undefined || v === null || v === "" ? "—" : String(v);
    });
    if (values.some((v) => v !== "—")) rows.push({ label: key, values });
  }
  return rows;
}

/** Attributes exist and are real — only the "which to pick" judgment call
 *  needs the model; the row data itself is never LLM-generated. */
async function getRecommendationFromRows(products: Product[], rows: CompareRow[]): Promise<string> {
  const table = rows
    .map((r) => `${r.label}: ${products.map((p, i) => `${p.name}=${r.values[i]}`).join(", ")}`)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        'Given this product comparison table, recommend which product to pick and briefly explain why. Respond with ONLY JSON: {"recommendation": string}. 2-3 concise sentences.',
    },
    { role: "user", content: `Products: ${products.map((p) => p.name).join(" vs ")}\n\n${table}` },
  ];

  try {
    const result = await completeJson(messages);
    const parsed = JSON.parse(result.raw);
    if (typeof parsed?.recommendation === "string" && parsed.recommendation.trim()) {
      return parsed.recommendation.trim();
    }
  } catch (err) {
    console.error("Compare: recommendation LLM call failed.", err);
  }
  return "Both are solid options — compare the specs above against what matters most to you.";
}

/**
 * Always returns database-grounded rows: price, availability/stock, brand,
 * and any structured attributes from Product.attributes. Never uses the LLM
 * to generate product specifications — if structured attributes are absent
 * the comparison falls back to only the verified fields.
 */
function databaseRows(ordered: Product[]): CompareRow[] {
  const rows: CompareRow[] = [];

  rows.push({ label: "Price", values: ordered.map((p) => formatMoney(p.price, p.currency)) });

  rows.push({
    label: "Availability",
    values: ordered.map((p) => p.inventoryStatus.replace("_", " ").toLowerCase()),
  });

  const brands = ordered.map((p) => p.brand ?? "—");
  if (brands.some((b) => b !== "—")) {
    rows.push({ label: "Brand", values: brands });
  }

  rows.push(...attributesFromRealData(ordered));

  return rows;
}

export async function compareProducts(orgId: string, productIds: string[]): Promise<CompareResult> {
  const uniqueIds = [...new Set(productIds)].slice(0, 2);
  if (uniqueIds.length < 2) throw new ApiError(400, "Two distinct productIds are required.");

  const products = await prisma.product.findMany({ where: { id: { in: uniqueIds }, orgId } });
  if (products.length < 2) throw new ApiError(404, "One or more products were not found.");

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = uniqueIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));

  const rows = databaseRows(ordered);

  let recommendation: string;
  if (rows.length > 2) {
    // Has at least price + availability + one more row — worth asking the LLM
    // for a recommendation based on the verified data.
    recommendation = await getRecommendationFromRows(ordered, rows);
  } else {
    recommendation =
      "We don't have enough detail to compare these beyond price and availability yet.";
  }

  return {
    products: ordered.map((p) => ({ id: p.id, name: p.name, price: formatMoney(p.price, p.currency) })),
    rows,
    recommendation,
  };
}
