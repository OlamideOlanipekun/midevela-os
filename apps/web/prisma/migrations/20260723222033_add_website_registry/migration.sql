-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "WebsiteVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "WebsiteCrawlStatus" AS ENUM ('NOT_STARTED', 'CRAWLING', 'INDEXING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "website_registry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "verification_status" "WebsiteVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "crawl_status" "WebsiteCrawlStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "last_crawled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_registry_normalized_url_key" ON "website_registry"("normalized_url");

-- CreateIndex
CREATE INDEX "website_registry_org_id_idx" ON "website_registry"("org_id");

-- AddForeignKey
ALTER TABLE "website_registry" ADD CONSTRAINT "website_registry_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
