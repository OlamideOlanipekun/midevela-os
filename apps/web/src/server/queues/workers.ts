import { createWorker } from "@/server/queues/queue";
import { publishKnowledgeIndexed, publishImportStarted } from "@/server/events/instrument";

export function registerWorkers(): void {
  createWorker({
    name: "embedding",
    concurrency: 3,
    handler: async (job) => {
      const { orgId, entryId } = job.data;
      publishKnowledgeIndexed(orgId, entryId, "document", 1);
    },
  });

  createWorker({
    name: "import",
    concurrency: 2,
    handler: async (job) => {
      const { orgId, source } = job.data;
      publishImportStarted(orgId, source, 0);
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
