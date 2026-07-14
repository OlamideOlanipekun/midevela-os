-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "qualification_flow" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "context" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brand" TEXT;

-- CreateIndex
CREATE INDEX "products_org_id_brand_idx" ON "products"("org_id", "brand");
