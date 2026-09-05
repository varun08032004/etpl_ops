-- Migration 018: Carbon Academy Extensions
-- Run AFTER 015_training_engine.sql, 016_training_fixes.sql, 017_training_progress_unique.sql
-- Adds Carbon Academy specific extensions: learning objectives, specialist tracks, 
-- certification levels, governance rules, capstone requirements, role mappings

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────────────
CREATE TYPE carbon_academy_tier AS ENUM ('foundation', 'professional', 'india_ether_track', 'capstone');
CREATE TYPE learning_objective_category AS ENUM ('knowledge', 'interpretation', 'calculation', 'analysis', 'application', 'evaluation', 'decision_making', 'communication', 'operational_competency', 'technical_competency');
CREATE TYPE assessment_type AS ENUM ('course', 'module', 'practical', 'applied_competency', 'capstone', 'specialist_track');
CREATE TYPE specialist_track_type AS ENUM ('carbon_operations', 'engineering_advanced', 'compliance_advanced', 'finance_advanced', 'sales_business_development', 'product', 'management');
CREATE TYPE certification_level AS ENUM ('carbon_foundations', 'carbon_operations', 'carbon_project_analyst', 'ether_track_carbon_specialist');
CREATE TYPE content_version_status AS ENUM ('draft', 'review', 'approved', 'published', 'retired');
CREATE TYPE governance_review_frequency AS ENUM ('annual', 'semi_annual', 'quarterly', 'per_release', 'biennial');

-- ── CARBON ACADEMY PROGRAMME ──────────────────────────────────────────────
-- The main EtherTrack Carbon Academy programme (seeded as a training_programme)

-- ── LEARNING OBJECTIVES ──────────────────────────────────────────────────
-- Structured learning objectives at lesson and course level

CREATE TABLE carbon_academy_learning_objectives (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type           VARCHAR(50) NOT NULL,                     -- 'lesson', 'course', 'module'
  entity_id             UUID NOT NULL,                            -- references lesson_id, course_id, or module_id
  objective_code        VARCHAR(50) NOT NULL,                     -- e.g., 'C01.1.1', 'C04.2.3'
  objective_statement   TEXT NOT NULL,                            -- Measurable learning outcome
  bloom_level           VARCHAR(30),                              -- 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
  category              learning_objective_category,
  competency_category   VARCHAR(50),                              -- e.g., 'knowledge', 'calculation', 'analysis'
  measurable_outcome    TEXT,                                     -- How achievement is measured
  assessment_linkage    UUID,                                     -- links to assessment if directly assessed
  practical_linkage     UUID,                                     -- links to practical exercise if applicable
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN DEFAULT TRUE,
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learning_objectives_entity ON carbon_academy_learning_objectives(entity_type, entity_id);
CREATE INDEX idx_learning_objectives_code ON carbon_academy_learning_objectives(objective_code);

-- Junction: Lesson <-> Learning Objectives (many-to-many, as objectives can be shared)
CREATE TABLE carbon_academy_lesson_objectives (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id             UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  objective_id          UUID NOT NULL REFERENCES carbon_academy_learning_objectives(id) ON DELETE CASCADE,
  is_primary            BOOLEAN DEFAULT FALSE,                    -- primary objective for this lesson
  created_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE (lesson_id, objective_id)
);

CREATE INDEX idx_lesson_objectives_lesson ON carbon_academy_lesson_objectives(lesson_id);
CREATE INDEX idx_lesson_objectives_objective ON carbon_academy_lesson_objectives(objective_id);

-- ── PRACTICAL EXERCISES EXTENSION ────────────────────────────────────────
-- Extends training_exercises with Carbon Academy specific fields

ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS exercise_code VARCHAR(50);          -- e.g., 'C06-EX-01'
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS competency VARCHAR(100);            -- competency category
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS inputs_data JSONB;                  -- input data for exercise
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS expected_deliverable TEXT;          -- what learner produces
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS evaluation_criteria JSONB;          -- scoring criteria
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS scoring_rubric JSONB;               -- detailed rubric
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS passing_threshold NUMERIC(5,2) DEFAULT 70; -- percentage
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS instructor_review_required BOOLEAN DEFAULT TRUE;
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS grading_type VARCHAR(20) DEFAULT 'manual'; -- 'manual', 'automated', 'peer'
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS competency_category VARCHAR(50);    -- links to competency framework
ALTER TABLE training_exercises ADD COLUMN IF NOT EXISTS exercise_tier VARCHAR(20) DEFAULT 'common'; -- 'common', 'specialist'

-- ── ASSESSMENT FRAMEWORK EXTENSIONS ──────────────────────────────────────

-- Assessment types enum already exists in training_engine
-- Add Carbon Academy specific fields to training_assessments
ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS assessment_type assessment_type;
ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2) DEFAULT 100;       -- weight in course/programme
ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS competency_linkage UUID;             -- links to competency
ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS version_linkage UUID;                -- links to content version
ALTER TABLE training_assessments ADD COLUMN IF NOT EXISTS assessment_tier VARCHAR(20) DEFAULT 'course'; -- 'course', 'module', 'lesson', 'programme'

-- ── CERTIFICATION LEVELS & REQUIREMENTS ──────────────────────────────────

CREATE TABLE carbon_academy_certification_levels (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_name                  certification_level NOT NULL,
  level_number                INTEGER NOT NULL UNIQUE,              -- 1, 2, 3, 4
  title                       VARCHAR(100) NOT NULL,                -- 'Carbon Foundations', 'Carbon Operations', etc.
  description                 TEXT,
  is_mandatory                BOOLEAN DEFAULT FALSE,                -- required for all employees
  course_requirements         JSONB NOT NULL,                       -- {required_courses: [], optional_courses: []}
  practical_requirements      JSONB,                                -- required practical exercises
  assessment_weights          JSONB NOT NULL,                       -- {course_assessments: 40, practical: 40, capstone: 20}
  minimum_overall_score       NUMERIC(5,2) NOT NULL,                -- 70, 75, 80, 85
  minimum_course_score        NUMERIC(5,2) NOT NULL,                -- per-course minimum
  capstone_required           BOOLEAN DEFAULT FALSE,
  capstone_minimum_score      NUMERIC(5,2),                         -- minimum capstone score
  critical_competency_min     NUMERIC(5,2),                         -- minimum for critical competencies
  is_active                   BOOLEAN DEFAULT TRUE,
  created_by                  UUID NOT NULL REFERENCES staff_accounts(id),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- Certification requirements per level
CREATE TABLE carbon_academy_certification_requirements (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certification_level_id      UUID NOT NULL REFERENCES carbon_academy_certification_levels(id) ON DELETE CASCADE,
  course_id                   UUID REFERENCES training_courses(id), -- specific course requirement
  is_required                 BOOLEAN DEFAULT TRUE,
  minimum_score               NUMERIC(5,2) DEFAULT 70,              -- minimum score for this course
  weight                      NUMERIC(5,2) DEFAULT 1,               -- weight in overall score
  created_at                  TIMESTAMP DEFAULT NOW()
);

-- ── SPECIALIST TRACKS ────────────────────────────────────────────────────

CREATE TABLE carbon_academy_specialist_tracks (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_type                  specialist_track_type NOT NULL UNIQUE,
  track_name                  VARCHAR(100) NOT NULL,
  description                 TEXT,
  base_tier                   VARCHAR(20) DEFAULT 'professional',   -- 'foundation', 'professional', 'specialist'
  prerequisite_track_id       UUID REFERENCES carbon_academy_specialist_tracks(id), -- e.g., carbon_operations is prerequisite for engineering_advanced
  total_hours                 NUMERIC(6,2),
  is_active                   BOOLEAN DEFAULT TRUE,
  created_by                  UUID NOT NULL REFERENCES staff_accounts(id),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- Specialist track course requirements
CREATE TABLE carbon_academy_track_courses (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id                    UUID NOT NULL REFERENCES carbon_academy_specialist_tracks(id) ON DELETE CASCADE,
  course_id                   UUID NOT NULL REFERENCES training_courses(id),
  is_required                 BOOLEAN DEFAULT TRUE,
  display_order               INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMP DEFAULT NOW(),
  UNIQUE (track_id, course_id)
);

-- ── ROLE-TRACK MAPPINGS ────────────────────────────────────────────────

CREATE TABLE carbon_academy_role_tracks (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name                   VARCHAR(100) NOT NULL,                -- e.g., 'Carbon Operations', 'Engineering', 'Compliance'
  department                  VARCHAR(100),                         -- department name
  job_function                VARCHAR(100),                         -- job function/title
  mandatory_track_id          UUID REFERENCES carbon_academy_specialist_tracks(id), -- e.g., carbon_operations
  optional_track_ids          UUID[],                               -- array of optional track IDs
  is_active                   BOOLEAN DEFAULT TRUE,
  created_by                  UUID NOT NULL REFERENCES staff_accounts(id),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- ── CONTENT VERSIONING EXTENSIONS ──────────────────────────────────────

-- Extend training_content_versions with Carbon Academy specific fields
ALTER TABLE training_content_versions ADD COLUMN IF NOT EXISTS content_version_status content_version_status DEFAULT 'draft';
ALTER TABLE training_content_versions ADD COLUMN IF NOT EXISTS curriculum_version VARCHAR(20); -- e.g., '1.2'
ALTER TABLE training_content_versions ADD COLUMN IF NOT EXISTS change_type VARCHAR(50);        -- 'minor_revision', 'major_revision', 'mandatory_refresher', 'recertification'

-- ── GOVERNANCE RULES ───────────────────────────────────────────────────

CREATE TABLE carbon_academy_governance_rules (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_area                VARCHAR(100) NOT NULL,                -- e.g., 'CCTS / Indian Regulation'
  review_frequency            governance_review_frequency NOT NULL,
  responsible_owner           UUID NOT NULL REFERENCES staff_accounts(id),
  authoritative_source        TEXT NOT NULL,                        -- URL or reference to authoritative source
  last_reviewed               TIMESTAMP,
  next_review_due             TIMESTAMP,
  trigger_conditions          JSONB,                                -- array of trigger conditions
  impact_assessment_status    VARCHAR(50) DEFAULT 'pending',        -- 'pending', 'in_progress', 'completed', 'not_required'
  last_impact_assessment      TIMESTAMP,
  is_active                   BOOLEAN DEFAULT TRUE,
  created_by                  UUID NOT NULL REFERENCES staff_accounts(id),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- ── CAPSTONE REQUIREMENTS ──────────────────────────────────────────────

CREATE TABLE carbon_academy_capstone_requirements (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programme_id                UUID NOT NULL REFERENCES training_programmes(id) ON DELETE CASCADE,
  component_name              VARCHAR(100) NOT NULL,                -- 'Due Diligence Report', 'Financial Model', etc.
  weight_percentage           NUMERIC(5,2) NOT NULL,                -- 30, 25, 15, 30
  description                 TEXT,
  minimum_score               NUMERIC(5,2) DEFAULT 70,              -- minimum score for this component
  is_mandatory                BOOLEAN DEFAULT TRUE,
  critical_failure_rules      JSONB,                                -- array of critical failure conditions
  role_specific_depth         JSONB,                                -- role-specific depth requirements
  created_by                  UUID NOT NULL REFERENCES staff_accounts(id),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- ── ROLE-TRACK MAPPINGS (Employee role -> tracks) ──────────────────────

CREATE TABLE carbon_academy_employee_tracks (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id                 UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  track_id                    UUID NOT NULL REFERENCES carbon_academy_specialist_tracks(id) ON DELETE CASCADE,
  assigned_by                 UUID NOT NULL REFERENCES staff_accounts(id),
  assigned_at                 TIMESTAMP DEFAULT NOW(),
  is_active                   BOOLEAN DEFAULT TRUE,
  UNIQUE (employee_id, track_id)
);

-- ── UPDATED_AT TRIGGERS ────────────────────────────────────────────────

CREATE TRIGGER trg_carbon_academy_learning_objectives_updated BEFORE UPDATE ON carbon_academy_learning_objectives FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_carbon_academy_certification_levels_updated BEFORE UPDATE ON carbon_academy_certification_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_carbon_academy_specialist_tracks_updated BEFORE UPDATE ON carbon_academy_specialist_tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_carbon_academy_governance_rules_updated BEFORE UPDATE ON carbon_academy_governance_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_carbon_academy_capstone_requirements_updated BEFORE UPDATE ON carbon_academy_capstone_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_carbon_academy_role_tracks_updated BEFORE UPDATE ON carbon_academy_role_tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW LEVEL SECURITY PREPARATION ─────────────────────────────────────

ALTER TABLE carbon_academy_learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_lesson_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_exercises ENABLE ROW LEVEL SECURITY; -- already enabled, but ensuring
ALTER TABLE carbon_academy_certification_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_certification_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_specialist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_track_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_role_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_governance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_capstone_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_academy_employee_tracks ENABLE ROW LEVEL SECURITY;

-- Placeholder policies (refined in application-layer authorization)
DO $$ BEGIN
  CREATE POLICY carbon_academy_learning_objectives_all ON carbon_academy_learning_objectives FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_lesson_objectives_all ON carbon_academy_lesson_objectives FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_certification_levels_all ON carbon_academy_certification_levels FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_certification_requirements_all ON carbon_academy_certification_requirements FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_specialist_tracks_all ON carbon_academy_specialist_tracks FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_track_courses_all ON carbon_academy_track_courses FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_role_tracks_all ON carbon_academy_role_tracks FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_governance_rules_all ON carbon_academy_governance_rules FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_capstone_requirements_all ON carbon_academy_capstone_requirements FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY carbon_academy_employee_tracks_all ON carbon_academy_employee_tracks FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── INDEXES ────────────────────────────────────────────────────────────
 
CREATE INDEX idx_certification_requirements_level ON carbon_academy_certification_requirements(certification_level_id);
CREATE INDEX idx_track_courses_track ON carbon_academy_track_courses(track_id);
CREATE INDEX idx_track_courses_course ON carbon_academy_track_courses(course_id);
CREATE INDEX idx_role_tracks_role ON carbon_academy_role_tracks(role_name);
CREATE INDEX idx_governance_rules_area ON carbon_academy_governance_rules(content_area);
CREATE INDEX idx_capstone_requirements_programme ON carbon_academy_capstone_requirements(programme_id);
CREATE INDEX idx_employee_tracks_employee ON carbon_academy_employee_tracks(employee_id);
CREATE INDEX idx_employee_tracks_track ON carbon_academy_employee_tracks(track_id);