-- HNSW index on chunks.embedding for fast cosine-similarity search.
--
-- Why HNSW over IVFflat:
--   * Higher recall (0.99+ vs ~0.95 for IVFflat with lists=10) at comparable
--     query latency.
--   * No need to rebuild as the table grows — IVFflat clusters become stale
--     past ~10x growth and require REINDEX with a larger `lists`.
--   * Slightly slower build, more memory at index time, but our chunks table
--     is small and grows incrementally per user upload.
--
-- Operator class: vector_cosine_ops — RetrievalService uses the `<=>` operator
-- (cosine distance). Other choices (vector_l2_ops, vector_ip_ops) would be
-- ignored by the planner for our query shape.
--
-- Parameters (pgvector defaults):
--   m = 16              max number of connections per layer
--   ef_construction = 64  size of the dynamic candidate list at build time
-- These are reasonable for 768-dim embeddings; tune ef_search at query time
-- via `SET hnsw.ef_search = N` if recall ever needs bumping.
--
-- The index is built on an empty table (chunks were truncated in
-- 20260426112450_global_documents). HNSW updates incrementally on INSERT, so
-- new chunks are indexed automatically with no manual rebuild.

CREATE INDEX IF NOT EXISTS "chunks_embedding_hnsw_idx"
  ON "chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
