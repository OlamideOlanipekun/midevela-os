import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeDomainHostname, backfillEmptyDomains } from "../backfillDomains";

// Mock the prisma client
vi.mock("@/lib/prisma", () => ({
  default: {
    widgetKey: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";

const mockFindMany = prisma.widgetKey.findMany as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.widgetKey.update as ReturnType<typeof vi.fn>;

describe("normalizeDomainHostname", () => {
  it("extracts hostname from full URL", () => {
    expect(normalizeDomainHostname("https://shop.com/path?q=1")).toBe("shop.com");
  });

  it("pads scheme onto bare domain", () => {
    expect(normalizeDomainHostname("shop.com")).toBe("shop.com");
  });

  it("strips www prefix", () => {
    expect(normalizeDomainHostname("https://www.my-store.com")).toBe("www.my-store.com");
  });

  it("lowercases hostname", () => {
    expect(normalizeDomainHostname("SHOP.COM")).toBe("shop.com");
  });

  it("preserves subdomains", () => {
    expect(normalizeDomainHostname("https://store.shop.com")).toBe("store.shop.com");
  });

  it("strips port", () => {
    expect(normalizeDomainHostname("https://shop.com:3000")).toBe("shop.com");
  });

  it("returns null for null input", () => {
    expect(normalizeDomainHostname(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeDomainHostname(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeDomainHostname("")).toBeNull();
    expect(normalizeDomainHostname("   ")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(normalizeDomainHostname("not a url at all!!!")).toBeNull();
  });

  it("handles IP address", () => {
    expect(normalizeDomainHostname("192.168.1.1")).toBe("192.168.1.1");
  });
});

describe("backfillEmptyDomains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("backfills keys with empty allowlist + valid websiteUrl (live mode)", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "key-1",
        orgId: "org-1",
        allowedDomains: [],
        active: true,
        org: { id: "org-1", websiteUrl: "https://mystore.com" },
      },
      {
        id: "key-2",
        orgId: "org-2",
        allowedDomains: [],
        active: true,
        org: { id: "org-2", websiteUrl: "https://shop.co.uk" },
      },
    ]);
    mockUpdate.mockResolvedValue({});

    const report = await backfillEmptyDomains(false);

    expect(report.scanned).toBe(2);
    expect(report.backfilled).toBe(2);
    expect(report.skippedNoWebsite).toBe(0);
    expect(report.skippedInvalidUrl).toBe(0);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { allowedDomains: ["mystore.com"] },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "key-2" },
      data: { allowedDomains: ["shop.co.uk"] },
    });
    expect(report.entries).toHaveLength(2);
  });

  it("reports entries without calling update in dry-run mode", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "key-1",
        orgId: "org-1",
        allowedDomains: [],
        active: true,
        org: { id: "org-1", websiteUrl: "https://mystore.com" },
      },
    ]);

    const report = await backfillEmptyDomains(true);

    expect(report.scanned).toBe(1);
    expect(report.backfilled).toBe(1);
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0].normalizedDomain).toBe("mystore.com");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips keys with empty allowlist + missing websiteUrl", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "key-1",
        orgId: "org-1",
        allowedDomains: [],
        active: true,
        org: { id: "org-1", websiteUrl: null },
      },
      {
        id: "key-2",
        orgId: "org-2",
        allowedDomains: [],
        active: true,
        org: { id: "org-2", websiteUrl: "" },
      },
    ]);

    const report = await backfillEmptyDomains(false);

    expect(report.scanned).toBe(2);
    expect(report.backfilled).toBe(0);
    expect(report.skippedNoWebsite).toBe(2);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips keys with empty allowlist + invalid websiteUrl", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "key-1",
        orgId: "org-1",
        allowedDomains: [],
        active: true,
        org: { id: "org-1", websiteUrl: "!!! not a url" },
      },
    ]);

    const report = await backfillEmptyDomains(false);

    expect(report.scanned).toBe(1);
    expect(report.backfilled).toBe(0);
    expect(report.skippedInvalidUrl).toBe(1);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].reason).toContain("Invalid websiteUrl");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does NOT touch keys with existing non-empty allowlist", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "key-1",
        orgId: "org-1",
        allowedDomains: ["shop.com"],
        active: true,
        org: { id: "org-1", websiteUrl: "https://other.com" },
      },
      {
        id: "key-2",
        orgId: "org-2",
        allowedDomains: ["store.com", "cdn.store.com"],
        active: true,
        org: { id: "org-2", websiteUrl: "https://store.com" },
      },
    ]);

    const report = await backfillEmptyDomains(false);

    expect(report.scanned).toBe(2);
    expect(report.backfilled).toBe(0);
    expect(report.alreadyConfigured).toBe(2);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("reports errors when update fails in live mode", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "key-1",
        orgId: "org-1",
        allowedDomains: [],
        active: true,
        org: { id: "org-1", websiteUrl: "https://valid.com" },
      },
    ]);
    mockUpdate.mockRejectedValue(new Error("DB connection lost"));

    const report = await backfillEmptyDomains(false);

    expect(report.scanned).toBe(1);
    expect(report.backfilled).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].reason).toContain("DB connection lost");
  });
});
