-- Restore the pgvector HNSW cosine index on embeddings.
--
-- This index is created in raw SQL in the init migration because it sits
-- on an Unsupported("vector(1024)") column that the Prisma schema can't
-- model. Because the schema doesn't know about it, `prisma migrate dev`
-- sees it as drift and generates a DROP (the 20260713091150 migration did
-- exactly that). This migration puts it back.
--
-- KNOWN HAZARD: future `prisma migrate dev` runs will AGAIN try to drop
-- this index. When that happens, delete the generated `DROP INDEX
-- "embeddings_embedding_hnsw_idx";` line from the new migration before
-- applying, or add another restore migration like this one. The retrieval
-- RAG path (server/retrieval/search.ts, cosine `<=>`) depends on it for
-- performance at scale.
CREATE INDEX IF NOT EXISTS "embeddings_embedding_hnsw_idx"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
