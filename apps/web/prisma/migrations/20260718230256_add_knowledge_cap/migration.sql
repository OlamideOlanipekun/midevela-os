-- DropIndex
DROP INDEX "embeddings_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "knowledge_cap" INTEGER NOT NULL DEFAULT 10;
