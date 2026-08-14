import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueue, createWorker } from "../queue";
import { registerWorkers } from "../workers";

describe("Background Ingestion — Queue & Worker Pipeline", () => {
  beforeEach(() => {
    registerWorkers();
  });

  it("registers in-process worker handlers and processes enqueued jobs asynchronously", async () => {
    let processedData: any = null;

    createWorker({
      name: "test-queue",
      handler: async (job) => {
        processedData = job.data;
      },
    });

    await enqueue("test-queue", { message: "hello-background" });

    // Wait for in-process setImmediate execution
    await new Promise((r) => setTimeout(r, 50));

    expect(processedData).toEqual({ message: "hello-background" });
  });

  it("triggers worker execution when jobs are enqueued to 'crawl' queue", async () => {
    const executed: string[] = [];

    createWorker({
      name: "crawl-test",
      handler: async (job) => {
        executed.push(job.data.crawlId);
      },
    });

    await enqueue("crawl-test", { orgId: "org-1", websiteId: "ws-1", crawlId: "crawl-100", rawUrl: "https://example.com" });

    await new Promise((r) => setTimeout(r, 50));

    expect(executed).toContain("crawl-100");
  });
});
