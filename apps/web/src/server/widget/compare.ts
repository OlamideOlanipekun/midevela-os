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
 * Sparse/no attributes (typical for crawled products) — the model reads
 * the descriptions and produces both the comparison rows and the
 * recommendation. Explicitly told to use ONLY stated facts, same rule as
 * the main conversation engine's grounding.
 */
async function getLlmComparison(products: Product[]): Promise<{ rows: CompareRow[]; recommendation: string }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You are comparing two products from the same store.",
        "Read their descriptions and produce a short comparison table plus a recommendation.",
        "Only use facts stated in the descriptions below — never invent specs, numbers, or features that aren't mentioned.",
        'Respond with ONLY JSON: {"rows": [{"label": string, "values": [string, string]}], "recommendation": string}',
        "At most 4 rows. recommendation should be 2-3 concise sentences.",
      ].join("\n"),
    },
    {
      role: "user",
      content: products
        .map((p, i) => `Product ${i + 1}: ${p.name}\nDescription: ${p.description || "(no description provided)"}`)
        .join("\n\n"),
    },
  ];

  try {
    const result = await completeJson(messages);
    const parsed = JSON.parse(result.raw);
    const rawRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const rows: CompareRow[] = rawRows
      .filter((r: unknown): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      .map((r: Record<string, unknown>) => ({
        label: typeof r.label === "string" ? r.label : "Comparison",
        values: Array.isArray(r.values)
          ? r.values.slice(0, 2).map((v: unknown) => (typeof v === "string" ? v : String(v ?? "—")))
          : ["—", "—"],
      }))
      .slice(0, 4);
    const recommendation =
      typeof parsed?.recommendation === "string" && parsed.recommendation.trim()
        ? parsed.recommendation.trim()
        : "Both look like solid choices based on the available details.";
    return { rows, recommendation };
  } catch (err) {
    console.error("Compare: LLM comparison failed, falling back to price/availability only.", err);
    return { rows: [], recommendation: "We don't have enough detail to compare these beyond price and availability yet." };
  }
}

export async function compareProducts(orgId: string, productIds: string[]): Promise<CompareResult> {
  const uniqueIds = [...new Set(productIds)].slice(0, 2); // v1 compares exactly two, per spec
  if (uniqueIds.length < 2) throw new ApiError(400, "Two distinct productIds are required.");

  const products = await prisma.product.findMany({ where: { id: { in: uniqueIds }, orgId } });
  if (products.length < 2) throw new ApiError(404, "One or more products were not found.");

  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = uniqueIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));

  const priceRow: CompareRow = { label: "Price", values: ordered.map((p) => formatMoney(p.price, p.currency)) };
  const stockRow: CompareRow = {
    label: "Availability",
    values: ordered.map((p) => p.inventoryStatus.replace("_", " ").toLowerCase()),
  };

  const attributeRows = attributesFromRealData(ordered);

  let extraRows: CompareRow[] = [];
  let recommendation: string;
  if (attributeRows.length > 0) {
    recommendation = await getRecommendationFromRows(ordered, [priceRow, stockRow, ...attributeRows]);
  } else {
    const llm = await getLlmComparison(ordered);
    extraRows = llm.rows;
    recommendation = llm.recommendation;
  }

  return {
    products: ordered.map((p) => ({ id: p.id, name: p.name, price: formatMoney(p.price, p.currency) })),
    rows: [priceRow, stockRow, ...attributeRows, ...extraRows],
    recommendation,
  };
}
