-- Migration 061: Recruitment tables (job postings, applications, candidates, interviews)
-- Run AFTER base schema.sql and 056_final_org_structure.sql (for departments/teams)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Job Postings (requisitions)
CREATE TABLE IF NOT EXISTS job_postings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 VARCHAR(200) NOT NULL,
  department_id         UUID REFERENCES departments(id),
  team_id               UUID REFERENCES teams(id),
  employment_type       VARCHAR(30) NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  description           TEXT,
  location              VARCHAR(200),
  experience_required   BOOLEAN DEFAULT TRUE,
  experience_min_years  NUMERIC(3,1),
  experience_max_years  NUMERIC(3,1),
  salary_range_min      NUMERIC(14,2),
  salary_range_max      NUMERIC(14,2),
  openings_count        INTEGER NOT NULL DEFAULT 1,
  filled_count          INTEGER NOT NULL DEFAULT 0,
  status                VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','filled','closed')),
  external_links        JSONB,
  pdf_url               VARCHAR(500),
  posted_by             UUID REFERENCES staff_accounts(id),
  closed_at             TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_department ON job_postings(department_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_posted_by ON job_postings(posted_by);

-- Candidates (applicants)
CREATE TABLE IF NOT EXISTS candidates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name             VARCHAR(255) NOT NULL,
  email                 VARCHAR(255),
  phone                 VARCHAR(20),
  source                VARCHAR(50) DEFAULT 'other',
  current_company       VARCHAR(200),
  current_designation   VARCHAR(200),
  total_experience_years NUMERIC(4,1),
  expected_ctc          NUMERIC(14,2),
  notice_period_days    INTEGER,
  notes                 TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(full_name);

-- Job Applications (pipeline)
CREATE TABLE IF NOT EXISTS job_applications (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_posting_id        UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  candidate_id          UUID REFERENCES candidates(id) ON DELETE SET NULL,
  -- For public applications without candidate record
  full_name             VARCHAR(255),
  email                 VARCHAR(255),
  phone                 VARCHAR(20),
  linkedin              VARCHAR(300),
  portfolio             VARCHAR(300),
  resume_url            VARCHAR(500),
  cover_letter          TEXT,
  answers               JSONB DEFAULT '{}',
  stage                 VARCHAR(30) NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied','screening','interview','offer','hired','rejected')),
  rejection_reason      TEXT,
  stage_updated_at      TIMESTAMP,
  hired_employee_id     UUID REFERENCES employees(id),
  applied_at            TIMESTAMP DEFAULT NOW(),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_job_email UNIQUE (job_posting_id, email)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_stage ON job_applications(stage);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate ON job_applications(candidate_id);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_application_id    UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  round_name            VARCHAR(100) NOT NULL,
  scheduled_at          TIMESTAMP,
  interviewer_employee_id UUID REFERENCES employees(id),
  mode                  VARCHAR(30) DEFAULT 'video' CHECK (mode IN ('video','phone','in_person')),
  status                VARCHAR(30) DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  feedback              TEXT,
  rating                INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(job_application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON interviews(interviewer_employee_id);

-- Updated_at trigger function (if not exists)
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trg_job_postings_updated_at ON job_postings;
CREATE TRIGGER trg_job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON candidates;
CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_job_applications_updated_at ON job_applications;
CREATE TRIGGER trg_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_interviews_updated_at ON interviews;
CREATE TRIGGER trg_interviews_updated_at
  BEFORE UPDATE ON interviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (placeholder - refine later)
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY job_postings_all ON job_postings FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY candidates_all ON candidates FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY job_applications_all ON job_applications FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY interviews_all ON interviews FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;