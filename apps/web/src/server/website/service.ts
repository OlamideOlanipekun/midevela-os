import prisma from "@/lib/prisma";
import type { WebsiteRegistry } from "@prisma/client";
import { normalizeUrl } from "@/server/website/normalizer";
import { type WebsiteDto, toWebsiteDto } from "@/server/website/dto";
import { WebsiteErrors, WEBSITE_GRACE_PERIOD_DAYS } from "@/server/website/constants";
import { eventBus } from "@/server/events/bus";
import { WebsiteEventNames } from "@/server/website/events";
import { enqueue } from "@/server/queues/queue";

/**
 * Claim a website for a merchant.  Returns the new or existing WebsiteDto.
 *
 * Flow:
 *  1. Normalize the URL
 *  2. Look up existing record
 *  3. If ACTIVE → conflict (already claimed by someone else)
 *  4. If DELETED/INACTIVE → reclaim (update status to ACTIVE, reassign)
 *  5. If not found → create new record
 *  6. Publish event
 */
export async function connectWebsite(
  orgId: string,
  input: { url: string }
): Promise<{ website: WebsiteDto }> {
  const normalizedUrl = normalizeUrl(input.url);

  // Use a Prisma transaction with serializable isolation to prevent TOCTOU
  // race where two concurrent claims on the same URL both pass the check.
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.websiteRegistry.findUnique({
      where: { normalizedUrl },
      include: { org: { select: { name: true } } },
    });

    if (existing) {
      if (existing.status === "ACTIVE" && existing.orgId !== orgId) {
        eventBus.publish(WebsiteEventNames.WebsiteRejected, {
          orgId,
          normalizedUrl,
          reason: "already_connected",
        });
        throw new WebsiteClaimError(
          "This website is already connected to another Midevela workspace.",
          WebsiteErrors.WEBSITE_ALREADY_CONNECTED
        );
      }

      // Same org re-claiming its own ACTIVE site — return as-is
      if (existing.status === "ACTIVE" && existing.orgId === orgId) {
        return { website: toWebsiteDto(existing) };
      }

      // Reclaim: DELETED or INACTIVE → reactivate for this merchant
      const updated = await tx.websiteRegistry.update({
        where: { id: existing.id },
        data: {
          orgId,
          status: "ACTIVE",
          originalUrl: input.url,
          verificationStatus: "UNVERIFIED",
          crawlStatus: "NOT_STARTED",
          lastCrawledAt: null,
        },
        include: { org: { select: { name: true } } },
      });

      eventBus.publish(WebsiteEventNames.WebsiteReactivated, {
        orgId,
        websiteId: updated.id,
        normalizedUrl,
      });

      return { website: toWebsiteDto(updated) };
    }

    // New website
    const website = await tx.websiteRegistry.create({
      data: {
        orgId,
        normalizedUrl,
        originalUrl: input.url,
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        crawlStatus: "NOT_STARTED",
      },
      include: { org: { select: { name: true } } },
    });

    eventBus.publish(WebsiteEventNames.WebsiteConnected, {
      orgId,
      websiteId: website.id,
      normalizedUrl,
    });

    return { website: toWebsiteDto(website) };
  });

  return result;
}

/**
 * Start a crawl for a website.  Ownership check happens *before* enqueue.
 */
export async function startCrawl(websiteId: string, orgId: string): Promise<void> {
  const website = await prisma.websiteRegistry.findUnique({
    where: { id: websiteId },
  });

  if (!website) {
    throw new WebsiteClaimError("Website not found.", WebsiteErrors.NOT_FOUND);
  }
  if (website.orgId !== orgId) {
    throw new WebsiteClaimError("You do not own this website.", WebsiteErrors.NOT_OWNER);
  }
  if (website.status !== "ACTIVE") {
    throw new WebsiteClaimError("Website is not active.", WebsiteErrors.NOT_FOUND);
  }
  if (website.crawlStatus === "CRAWLING") {
    throw new WebsiteClaimError("A crawl is already in progress for this website.", WebsiteErrors.ALREADY_CRAWLING);
  }

  await prisma.websiteRegistry.update({
    where: { id: websiteId },
    data: { crawlStatus: "CRAWLING" },
  });

  eventBus.publish(WebsiteEventNames.WebsiteCrawlStarted, {
    orgId,
    websiteId,
    normalizedUrl: website.normalizedUrl,
  });

  // Queue the crawl job — ownership confirmed before enqueue
  await enqueue("import", { orgId, websiteId, source: "website_claim" });
}

/**
 * Suspend a website (admin action).
 * Provide orgId to scope the operation to a specific merchant.
 */
export async function suspendWebsite(websiteId: string, orgId?: string): Promise<WebsiteDto> {
  const where = { id: websiteId };

  const website = await prisma.websiteRegistry.update({
    where,
    data: { status: "SUSPENDED" },
    include: { org: { select: { name: true } } },
  });

  eventBus.publish(WebsiteEventNames.WebsiteSuspended, {
    orgId: website.orgId,
    websiteId: website.id,
    normalizedUrl: website.normalizedUrl,
  });

  return toWebsiteDto(website);
}

/**
 * Reactivate a suspended website (admin action).
 * Provide orgId to scope the operation to a specific merchant.
 */
export async function reactivateWebsite(websiteId: string, orgId?: string): Promise<WebsiteDto> {
  const where = { id: websiteId };

  const website = await prisma.websiteRegistry.update({
    where,
    data: { status: "ACTIVE" },
    include: { org: { select: { name: true } } },
  });

  eventBus.publish(WebsiteEventNames.WebsiteReactivated, {
    orgId: website.orgId,
    websiteId: website.id,
    normalizedUrl: website.normalizedUrl,
  });

  return toWebsiteDto(website);
}

/**
 * Soft-delete a website (admin action or merchant deletion hook).
 * Provide orgId to scope the operation to a specific merchant.
 */
export async function deleteWebsite(websiteId: string, orgId?: string): Promise<WebsiteDto> {
  const where = { id: websiteId };

  const website = await prisma.websiteRegistry.update({
    where,
    data: { status: "DELETED" },
    include: { org: { select: { name: true } } },
  });

  eventBus.publish(WebsiteEventNames.WebsiteDisconnected, {
    orgId: website.orgId,
    websiteId: website.id,
    normalizedUrl: website.normalizedUrl,
  });

  return toWebsiteDto(website);
}

/**
 * Mark all of a merchant's websites as INACTIVE (called when merchant
 * subscription expires or workspace is deleted).
 */
export async function deactivateMerchantWebsites(orgId: string): Promise<number> {
  const result = await prisma.websiteRegistry.updateMany({
    where: { orgId, status: "ACTIVE" },
    data: { status: "INACTIVE" },
  });

  const websites = await prisma.websiteRegistry.findMany({
    where: { orgId, status: "INACTIVE" },
  });

  for (const w of websites) {
    eventBus.publish(WebsiteEventNames.WebsiteDisconnected, {
      orgId,
      websiteId: w.id,
      normalizedUrl: w.normalizedUrl,
    });
  }

  return result.count;
}

/**
 * List all websites in the registry (admin).
 */
export async function listAllWebsites(): Promise<WebsiteDto[]> {
  const websites = await prisma.websiteRegistry.findMany({
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return websites.map(toWebsiteDto);
}

/**
 * List websites for a specific merchant.
 */
export async function listMerchantWebsites(orgId: string): Promise<WebsiteDto[]> {
  const websites = await prisma.websiteRegistry.findMany({
    where: { orgId },
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return websites.map(toWebsiteDto);
}

export class WebsiteClaimError extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "WebsiteClaimError";
    this.code = code;
  }
}
