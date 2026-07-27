import { NextRequest, NextResponse } from "next/server";
import { requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { importProducts, type ImportRow } from "@/server/catalog/products";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";

const IMPORT_WINDOW_SEC = 60;
const IMPORT_PER_ORG = 3;

/**
 * Bulk product import. The client parses the CSV/Excel (dependency-free, in
 * the browser) and POSTs a JSON array of rows here — avoids multipart
 * handling and keeps the server contract simple. Returns a three-way,
 * per-row result (imported / skipped / warning), never a silent import.
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    const rows = body?.rows;
    if (!Array.isArray(rows)) {
      return jsonError(400, "Expected { rows: [...] }.");
    }

    // Rate limit: max 3 import requests per org per minute (each may contain
    // hundreds of rows — the row-level budget check inside importProducts is
    // the real cap, this prevents hammering the endpoint).
    const ip = clientIp(req.headers);
    const ipLimit = await rateLimit(`import:org:${org.id}`, IMPORT_PER_ORG, IMPORT_WINDOW_SEC);
    if (!ipLimit.ok) {
      return jsonError(429, "Too many import requests. Please wait a moment and try again.");
    }

    const result = await importProducts(org.id, rows as ImportRow[]);
    return NextResponse.json({ success: true, ...result });
  });
}
