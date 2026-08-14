import { createWorker } from "@/server/queues/queue";
import { publishKnowledgeIndexed, publishImportStarted } from "@/server/events/instrument";

export function registerWorkers(): void {
  createWorker({
    name: "crawl",
    concurrency: 1,
    handler: async (job) => {
      const { orgId, websiteId, crawlId, rawUrl, trigger } = job.data;
      const { runCrawl } = await import("@/server/website/crawler/orchestrator");
      await runCrawl({
        orgId,
        websiteId,
        crawlId,
        rawUrl,
        trigger: trigger || "MANUAL",
        log: (msg) => console.log(`[worker:crawl:${crawlId}] ${msg}`),
      });
    },
  });

  createWorker({
    name: "embedding",
    concurrency: 3,
    handler: async (job) => {
      const { orgId, entryId, type } = job.data;
      publishKnowledgeIndexed(orgId, entryId, type || "document", 1);
    },
  });

  createWorker({
    name: "import",
    concurrency: 2,
    handler: async (job) => {
      const { orgId, websiteId, rawUrl, source } = job.data;
      publishImportStarted(orgId, source || "URL", 0);
      if (rawUrl) {
        const { importCatalogFromUrl } = await import("@/server/catalog/catalogImporter");
        await importCatalogFromUrl(orgId, rawUrl);
      }
    },
  });

  createWorker({
    name: "brand-detect",
    concurrency: 2,
    handler: async (job) => {
      const { orgId, websiteId, url } = job.data;
      const { detectAndSaveBrand } = await import("@/server/branding/service");
      await detectAndSaveBrand(websiteId, orgId, url);
    },
  });

  createWorker({
    name: "notification",
    concurrency: 10,
    handler: async (job) => {
      const { adminId, type, title, message } = job.data;
      const { createNotification } = await import("@/server/admin/notifications");
      await createNotification(adminId, type, title, message);
    },
  });

  createWorker({
    name: "analytics",
    concurrency: 1,
    handler: async () => {},
  });

  createWorker({
    name: "cleanup",
    concurrency: 1,
    handler: async () => {},
  });

  console.log("[Workers] registered");
}

// Auto-register workers on module load so handlers are ready
registerWorkers();

