import type { WebsiteRegistry, WebsiteStatus, WebsiteVerificationStatus, WebsiteCrawlStatus } from "@prisma/client";

export interface WebsiteDto {
  id: string;
  orgId: string;
  merchantName: string;
  normalizedUrl: string;
  originalUrl: string;
  status: WebsiteStatus;
  verificationStatus: WebsiteVerificationStatus;
  crawlStatus: WebsiteCrawlStatus;
  lastCrawledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toWebsiteDto(
  w: WebsiteRegistry & { org?: { name: string } | null }
): WebsiteDto {
  return {
    id: w.id,
    orgId: w.orgId,
    merchantName: w.org?.name ?? "Unknown",
    normalizedUrl: w.normalizedUrl,
    originalUrl: w.originalUrl,
    status: w.status,
    verificationStatus: w.verificationStatus,
    crawlStatus: w.crawlStatus,
    lastCrawledAt: w.lastCrawledAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export interface ConnectWebsiteInput {
  url: string;
}

export interface ConnectWebsiteResult {
  success: boolean;
  code?: string;
  message?: string;
  website?: WebsiteDto;
}
