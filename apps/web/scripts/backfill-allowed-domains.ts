import { backfillEmptyDomains, formatReport } from "../src/server/tenancy/backfillDomains";

/**
 * One-shot data migration: backfills allowedDomains on every active widget
 * key that has an empty allowlist.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-allowed-domains.ts
 *
 * Or with a dry-run preview:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-allowed-domains.ts --dry-run
 */
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  const report = await backfillEmptyDomains(isDryRun);
  console.log(formatReport(report, isDryRun));

  if (isDryRun) {
    console.log("\n⚠️  DRY RUN complete — no changes were made.");
  } else {
    console.log(`\n✅  Migration finished. ${report.backfilled} key(s) updated.`);
  }

  if (report.errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
