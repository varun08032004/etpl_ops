-- Migration 079: Migration Registry with Failure Evidence Preservation
-- Run this FIRST before any other migrations

CREATE TABLE schema_migrations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  migration_id       VARCHAR(50) NOT NULL UNIQUE,    -- e.g., '080_encrypt_bank_credentials'
  filename           VARCHAR(255) NOT NULL,
  checksum           VARCHAR(64) NOT NULL,           -- SHA-256
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Legal states: pending, applying, applied, failed, rolled_back
  applied_at         TIMESTAMP,
  applied_by         UUID REFERENCES staff_accounts(id),
  execution_time_ms  INTEGER,
  error_message      TEXT,
  checksum_verified  BOOLEAN DEFAULT FALSE,
  rolled_back_at     TIMESTAMP,
  rolled_back_by     UUID REFERENCES staff_accounts(id),
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_schema_migrations_id ON schema_migrations(migration_id);
CREATE INDEX idx_schema_migrations_status ON schema_migrations(status);

-- State transition trigger
CREATE OR REPLACE FUNCTION validate_migration_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Legal transitions:
  -- pending -> applying, failed
  -- applying -> applied, failed
  -- applied -> rolled_back
  -- failed -> applying, rolled_back
  CASE 
    WHEN OLD.status = 'pending' AND NEW.status IN ('applying', 'failed') THEN
    WHEN OLD.status = 'applying' AND NEW.status IN ('applied', 'failed') THEN
    WHEN OLD.status = 'applied' AND NEW.status = 'rolled_back' THEN
    WHEN OLD.status = 'failed' AND NEW.status IN ('applying', 'rolled_back') THEN
    ELSE
      RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
  END CASE;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_migration_state
  BEFORE UPDATE ON schema_migrations
  FOR EACH ROW EXECUTE FUNCTION validate_migration_transition();

-- RLS for migration registry (admin only in production)
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY schema_migrations_admin ON schema_migrations FOR ALL 
  USING (current_setting('app.current_user_role', true) IN ('owner', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;