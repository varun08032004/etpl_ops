-- ═══════════════════════════════════════════════════════════════════════════
-- RAG Schema for EtherTrack Internal Ops
-- Run this AFTER enabling pgvector extension in Supabase
-- Supabase Dashboard → Database → Extensions → Enable "vector"
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════════════════
-- RAG DOCUMENTS — source document metadata (one row per source document version)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE rag_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_table      VARCHAR(100) NOT NULL,                -- e.g. 'document_templates', 'documents', 'compliance_settings'
  source_id         UUID NOT NULL,                        -- PK from source table
  document_name     VARCHAR(500) NOT NULL,
  department_code   VARCHAR(50),                          -- for permission filtering (matches departments.code or template.department_code)
  role_required     staff_role,                           -- optional: minimum role to access (finance, hr, admin, owner)
  is_public         BOOLEAN DEFAULT FALSE,                -- visible to all authenticated users
  content_hash      VARCHAR(64) NOT NULL,                 -- SHA-256 of full document content (for idempotency)
  version           INTEGER DEFAULT 1,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE (source_table, source_id, version)
);

COMMENT ON TABLE rag_documents IS 'Metadata for each source document indexed for RAG. One row per document version.';

-- ═══════════════════════════════════════════════════════════════════════════
-- RAG CHUNKS — text chunks with embeddings for semantic search
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE rag_chunks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id       UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  chunk_index       INTEGER NOT NULL,                     -- order within document
  section           VARCHAR(200),                         -- e.g. "Leave Policy → Annual Leave", "P&L → Revenue"
  content           TEXT NOT NULL,                        -- the actual text chunk
  content_hash      VARCHAR(64) NOT NULL,                 -- SHA-256 of chunk content (for idempotent upsert)
  embedding         vector(768),                          -- Embedding dimension (768 for nomic-embed-text)
  metadata          JSONB DEFAULT '{}',                   -- flexible: {page, heading_level, table_name, etc.}
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE (document_id, chunk_index, content_hash)
);

COMMENT ON TABLE rag_chunks IS 'Text chunks with vector embeddings for semantic retrieval.';

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- IVFFlat index for approximate nearest neighbor search (cosine similarity)
-- HNSW limited to 2000 dimensions; Nemotron 3 Ultra uses 4096
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_chunks_embedding_ivfflat') THEN
    CREATE INDEX idx_rag_chunks_embedding_ivfflat ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
  END IF;
END $$;

-- Metadata filter indexes for permission-aware retrieval
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_chunks_dept') THEN
    CREATE INDEX idx_rag_chunks_dept ON rag_chunks ((metadata->>'department_code'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_chunks_role') THEN
    CREATE INDEX idx_rag_chunks_role ON rag_chunks ((metadata->>'role_required'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_chunks_public') THEN
    CREATE INDEX idx_rag_chunks_public ON rag_chunks (((metadata->>'is_public') = 'true'));
  END IF;
END $$;

-- Document lookup indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_documents_source') THEN
    CREATE INDEX idx_rag_documents_source ON rag_documents (source_table, source_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_documents_dept') THEN
    CREATE INDEX idx_rag_documents_dept ON rag_documents (department_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_documents_hash') THEN
    CREATE INDEX idx_rag_documents_hash ON rag_documents (content_hash);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS — auto update updated_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_rag_documents_updated_at BEFORE UPDATE ON rag_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rag_chunks_updated_at BEFORE UPDATE ON rag_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- AI CHAT LOG — extended with retrieval metadata
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_chat_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id          UUID NOT NULL REFERENCES staff_accounts(id),
  question          TEXT NOT NULL,
  answer            TEXT NOT NULL,
  tools_used        TEXT[],                          -- legacy: tool names from old assistant
  retrieved_chunks  JSONB,                           -- [{chunk_id, score, document_name, section, content_preview}]
  created_at        TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_chat_log_staff') THEN
    CREATE INDEX idx_ai_chat_log_staff ON ai_chat_log(staff_id, created_at DESC);
  END IF;
END $$;

COMMENT ON TABLE ai_chat_log IS 'AI Assistant conversation history with RAG retrieval metadata.';

-- ═══════════════════════════════════════════════════════════════════════════
-- RAG INGESTION LOG — track ingestion runs for observability
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE rag_ingestion_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_table      VARCHAR(100) NOT NULL,
  source_id         UUID,
  status            VARCHAR(20) NOT NULL,             -- 'success', 'skipped', 'failed'
  chunks_created    INTEGER DEFAULT 0,
  chunks_updated    INTEGER DEFAULT 0,
  chunks_deleted    INTEGER DEFAULT 0,
  error_message     TEXT,
  started_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_ingestion_log_source') THEN
    CREATE INDEX idx_rag_ingestion_log_source ON rag_ingestion_log(source_table, source_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_ingestion_log_started') THEN
    CREATE INDEX idx_rag_ingestion_log_started ON rag_ingestion_log(started_at DESC);
  END IF;
END $$;