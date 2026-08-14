import { describe, it, expect, vi } from "vitest";
import { triggerScheduledRecrawls } from "../orchestrator";
import { reconcileStaleProducts } from "@/server/website/reconciliation/products";
import prisma from "@/lib/prisma";
import { deleteEmbedding } from "@/server/knowledge/sync";

vi.mock("@/lib/prisma", () => ({
  default: {
    websiteRegistry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    crawl: {
      create: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/server/events/instrument", () => ({
  publishWebsiteCrawlStarted: vi.fn(),
}));

vi.mock("@/server/queues/queue", () => ({
  enqueue: vi.fn().mockResolvedValue("job-123"),
}));

vi.mock("@/server/knowledge/sync", () => ({
  deleteEmbedding: vi.fn().mockResolvedValue(undefined),
  syncProductEmbedding: vi.fn().mockResolvedValue(undefined),
}));

describe("Freshness — Scheduled Recrawls & Stale Cleanup", () => {
  it("enqueues scheduled recrawls for stale websites", async () => {
    vi.mocked(prisma.websiteRegistry.findMany).mockResolvedValueOnce([
      { id: "site-1", orgId: "org-1", originalUrl: "https://store1.com" },
      { id: "site-2", orgId: "org-2", originalUrl: "https://store2.com" },
    ] as any);

    vi.mocked(prisma.websiteRegistry.findUnique).mockImplementation(async (args: any) => {
      const id = args.where.id;
      if (id === "site-1") return { id: "site-1", orgId: "org-1", crawlStatus: "READY" } as any;
      if (id === "site-2") return { id: "site-2", orgId: "org-2", crawlStatus: "READY" } as any;
      return null;
    });

    vi.mocked(prisma.crawl.create).mockResolvedValue({ id: "crawl-99" } as any);

    const count = await triggerScheduledRecrawls(24);
    expect(count).toBe(2);
    expect(prisma.websiteRegistry.findMany).toHaveBeenCalled();
  });

  it("reconcileStaleProducts marks missing products OUT_OF_STOCK and purges embeddings", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: "p-stale-1" },
      { id: "p-stale-2" },
    ] as any);

    vi.mocked(prisma.product.updateMany).mockResolvedValueOnce({ count: 2 } as any);

    const activeSourceUrls = ["https://store1.com/products/active-item"];
    const count = await reconcileStaleProducts("org-1", activeSourceUrls);

    expect(count).toBe(2);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p-stale-1", "p-stale-2"] } },
      data: { inventoryStatus: "OUT_OF_STOCK" },
    });
    expect(deleteEmbedding).toHaveBeenCalledTimes(2);
    expect(deleteEmbedding).toHaveBeenCalledWith("PRODUCT", "p-stale-1");
    expect(deleteEmbedding).toHaveBeenCalledWith("PRODUCT", "p-stale-2");
  });
});
