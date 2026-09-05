-- Migration to add Carbon Academy role_tracks table
-- Run AFTER 018_carbon_academy_extensions.sql
-- Idempotent - safe to run multiple times

CREATE TABLE IF NOT EXISTS carbon_academy_role_tracks (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name                   VARCHAR(100) NOT NULL,
  department                  VARCHAR(100) NOT NULL,
  job_function                VARCHAR(100),
  mandatory_track_id          UUID NOT NULL REFERENCES carbon_academy_specialist_tracks(id) ON DELETE CASCADE,
  optional_track_ids          UUID[],
  is_active                   BOOLEAN DEFAULT TRUE,
  created_by                  UUID NOT NULL REFERENCES staff_accounts(id),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW(),
  UNIQUE (role_name, department)
);

CREATE INDEX IF NOT EXISTS idx_carbon_academy_role_tracks_mandatory ON carbon_academy_role_tracks(mandatory_track_id);
CREATE INDEX IF NOT EXISTS idx_carbon_academy_role_tracks_role ON carbon_academy_role_tracks(role_name, department);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_carbon_academy_role_tracks_updated'
  ) THEN
    CREATE TRIGGER trg_carbon_academy_role_tracks_updated 
    BEFORE UPDATE ON carbon_academy_role_tracks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE carbon_academy_role_tracks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY carbon_academy_role_tracks_all ON carbon_academy_role_tracks FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;