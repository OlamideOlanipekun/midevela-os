import prisma from "@/lib/prisma";

export interface BackfillEntry {
  widgetKeyId: string;
  orgId: string;
  websiteUrl: string;
  normalizedDomain: string;
}

export interface BackfillReport {
  scanned: number;
  backfilled: number;
  skippedNoWebsite: number;
  skippedInvalidUrl: number;
  alreadyConfigured: number;
  entries: BackfillEntry[];
  errors: Array<{ widgetKeyId: string; orgId: string; reason: string }>;
}

/**
 * Normalizes a raw URL/domain string to a bare hostname, or returns null
 * if the value is empty or unparseable. Accepts full URLs ("https://shop.com/path")
 * and bare domains ("shop.com").
 */
export function normalizeDomainHostname(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const hostname = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
    if (!hostname) return null;
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Scans every active widget key with an empty allowedDomains array and
 * backfills it from the owning organization's websiteUrl.
 *
 * Widget keys that already have one or more allowed domains are never
 * touched. Keys whose org has no websiteUrl or an unparseable one are
 * skipped and reported.
 */
export async function backfillEmptyDomains(dryRun = false): Promise<BackfillReport> {
  const report: BackfillReport = {
    scanned: 0,
    backfilled: 0,
    skippedNoWebsite: 0,
    skippedInvalidUrl: 0,
    alreadyConfigured: 0,
    entries: [],
    errors: [],
  };

  // Fetch ALL active widget keys with their orgs in a single query.
  // PostgreSQL stores empty text[] as {} which Prisma reads as [].
  const keys = await prisma.widgetKey.findMany({
    where: { active: true },
    include: { org: { select: { id: true, websiteUrl: true } } },
  });

  report.scanned = keys.length;

  for (const key of keys) {
    if (key.allowedDomains.length > 0) {
      report.alreadyConfigured++;
      continue;
    }

    const websiteUrl = key.org.websiteUrl;
    if (!websiteUrl) {
      report.skippedNoWebsite++;
      continue;
    }

    const hostname = normalizeDomainHostname(websiteUrl);
    if (!hostname) {
      report.skippedInvalidUrl++;
      report.errors.push({
        widgetKeyId: key.id,
        orgId: key.orgId,
        reason: `Invalid websiteUrl: "${websiteUrl}"`,
      });
      continue;
    }

    report.entries.push({
      widgetKeyId: key.id,
      orgId: key.orgId,
      websiteUrl,
      normalizedDomain: hostname,
    });

    if (dryRun) {
      report.backfilled++;
      continue;
    }

    try {
      await prisma.widgetKey.update({
        where: { id: key.id },
        data: { allowedDomains: [hostname] },
      });
      report.backfilled++;
    } catch (err) {
      report.errors.push({
        widgetKeyId: key.id,
        orgId: key.orgId,
        reason: `Update failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return report;
}

/**
 * Formats a BackfillReport into a human-readable summary for console output.
 */
export function formatReport(report: BackfillReport, dryRun = false): string {
  const header = dryRun ? "DRY RUN — no changes were made." : "Widget key domain backfill complete.";
  const lines = [
    header,
    ``,
    `  Scanned:                ${report.scanned}`,
    `  Backfilled:             ${report.backfilled}`,
    `  Already configured:     ${report.alreadyConfigured}`,
    `  Skipped (no website):   ${report.skippedNoWebsite}`,
    `  Skipped (invalid URL):  ${report.skippedInvalidUrl}`,
  ];

  if (dryRun && report.entries.length > 0) {
    lines.push(``, `  Would backfill (${report.entries.length}):`);
    for (const e of report.entries) {
      lines.push(`    - key ${e.widgetKeyId.slice(0, 8)}… / org ${e.orgId.slice(0, 8)}…`);
      lines.push(`      websiteUrl: "${e.websiteUrl}" → "${e.normalizedDomain}"`);
    }
  }

  if (report.errors.length > 0) {
    lines.push(``, `  Errors (${report.errors.length}):`);
    for (const e of report.errors) {
      lines.push(`    - key ${e.widgetKeyId.slice(0, 8)}… / org ${e.orgId.slice(0, 8)}…: ${e.reason}`);
    }
  }

  return lines.join("\n");
}
