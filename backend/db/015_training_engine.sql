-- Migration 015: Training & Learning Management Engine
-- Run AFTER base schema.sql and 009_missing_tables.sql
-- Creates the complete L&D platform for EtherTrack Carbon Academy and future programmes

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────────────

CREATE TYPE training_programme_status AS ENUM ('draft', 'placeholder', 'ready_for_review', 'published', 'active', 'archived');
CREATE TYPE training_course_status AS ENUM ('draft', 'placeholder', 'ready_for_review', 'published', 'active', 'archived');
CREATE TYPE training_content_status AS ENUM ('draft', 'review', 'published', 'active', 'updated', 'archived');
CREATE TYPE training_assignment_status AS ENUM ('assigned', 'in_progress', 'completed', 'overdue', 'failed', 'cancelled');
CREATE TYPE training_lesson_type AS ENUM ('video', 'document', 'external_resource', 'practical_exercise', 'assessment');
CREATE TYPE training_question_type AS ENUM ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay');
CREATE TYPE training_certificate_status AS ENUM ('issued', 'revoked', 'expired');

-- ── TRAINING PROGRAMMES ──────────────────────────────────────────────────

CREATE TABLE training_programmes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title               VARCHAR(300) NOT NULL,
  code                VARCHAR(50) UNIQUE,                         -- e.g. CA-2026, SEC-101
  description         TEXT,
  version             VARCHAR(20) NOT NULL DEFAULT '1.0',
  status              training_programme_status NOT NULL DEFAULT 'draft',
  duration_weeks      INTEGER,                                    -- NULL = configurable later
  total_estimated_hours NUMERIC(6,2),                             -- NULL = configurable later
  passing_score_pct   NUMERIC(5,2),                               -- NULL = configurable later
  certificate_template_id UUID REFERENCES documents(id),          -- PDF template for certificates
  created_by          UUID NOT NULL REFERENCES staff_accounts(id),
  updated_by          UUID REFERENCES staff_accounts(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  archived_at         TIMESTAMP,
  archived_by         UUID REFERENCES staff_accounts(id)
);

CREATE INDEX idx_training_programmes_status ON training_programmes(status);
CREATE INDEX idx_training_programmes_code ON training_programmes(code);

-- ── TRAINING COURSES ─────────────────────────────────────────────────────

CREATE TABLE training_courses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programme_id          UUID NOT NULL REFERENCES training_programmes(id) ON DELETE CASCADE,
  title                 VARCHAR(300) NOT NULL,
  code                  VARCHAR(50),                              -- e.g. CA-FUND, CA-GHG
  description           TEXT,
  version               VARCHAR(20) NOT NULL DEFAULT '1.0',
  status                training_course_status NOT NULL DEFAULT 'draft',
  display_order         INTEGER NOT NULL DEFAULT 0,
  duration_hours        NUMERIC(6,2),                             -- NULL = configurable later
  passing_score_pct     NUMERIC(5,2),                             -- NULL = configurable later
  is_mandatory          BOOLEAN DEFAULT TRUE,
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  updated_by            UUID REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  archived_at           TIMESTAMP,
  archived_by           UUID REFERENCES staff_accounts(id),
  UNIQUE (programme_id, code)
);

CREATE INDEX idx_training_courses_programme ON training_courses(programme_id);
CREATE INDEX idx_training_courses_status ON training_courses(status);
CREATE INDEX idx_training_courses_order ON training_courses(programme_id, display_order);

-- ── TRAINING MODULES ─────────────────────────────────────────────────────

CREATE TABLE training_modules (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id             UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  title                 VARCHAR(300) NOT NULL,
  description           TEXT,
  version               VARCHAR(20) NOT NULL DEFAULT '1.0',
  status                training_content_status NOT NULL DEFAULT 'draft',
  display_order         INTEGER NOT NULL DEFAULT 0,
  duration_hours        NUMERIC(6,2),
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  updated_by            UUID REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  archived_at           TIMESTAMP,
  archived_by           UUID REFERENCES staff_accounts(id)
);

CREATE INDEX idx_training_modules_course ON training_modules(course_id);
CREATE INDEX idx_training_modules_order ON training_modules(course_id, display_order);

-- ── TRAINING LESSONS ─────────────────────────────────────────────────────

CREATE TABLE training_lessons (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id             UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  title                 VARCHAR(300) NOT NULL,
  description           TEXT,
  lesson_type           training_lesson_type NOT NULL DEFAULT 'document',
  version               VARCHAR(20) NOT NULL DEFAULT '1.0',
  status                training_content_status NOT NULL DEFAULT 'draft',
  display_order         INTEGER NOT NULL DEFAULT 0,
  duration_minutes      INTEGER,
  is_required           BOOLEAN DEFAULT TRUE,
  content               JSONB,                                    -- Flexible content: video URLs, text, embed codes, etc.
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  updated_by            UUID REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  archived_at           TIMESTAMP,
  archived_by           UUID REFERENCES staff_accounts(id)
);

CREATE INDEX idx_training_lessons_module ON training_lessons(module_id);
CREATE INDEX idx_training_lessons_order ON training_lessons(module_id, display_order);

-- ── TRAINING MATERIALS (Documents, Videos, External Resources) ──────────

CREATE TABLE training_materials (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id             UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  title                 VARCHAR(300) NOT NULL,
  material_type         VARCHAR(50) NOT NULL,                     -- 'document', 'video', 'external_link', 'exercise_file'
  file_url              VARCHAR(1000),                            -- For uploaded files (via storage service)
  external_url          VARCHAR(1000),                            -- For YouTube, Vimeo, external resources
  file_size_bytes       BIGINT,
  mime_type             VARCHAR(100),
  duration_seconds      INTEGER,                                  -- For videos
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_downloadable       BOOLEAN DEFAULT TRUE,
  description           TEXT,
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_materials_lesson ON training_materials(lesson_id);

-- ── TRAINING EXERCISES (Practical/Hands-on) ──────────────────────────────

CREATE TABLE training_exercises (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id             UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  title                 VARCHAR(300) NOT NULL,
  instructions          TEXT NOT NULL,
  exercise_type         VARCHAR(50) NOT NULL,                     -- 'code', 'analysis', 'document_prep', 'presentation', 'reflection'
  estimated_hours       NUMERIC(4,2),
  submission_type       VARCHAR(50) DEFAULT 'file',               -- 'file', 'text', 'link', 'none'
  max_file_size_mb      INTEGER DEFAULT 50,
  allowed_file_types    TEXT[],                                   -- e.g. ['.pdf', '.docx', '.xlsx', '.py', '.ipynb']
  rubric                JSONB,                                    -- Grading rubric/criteria
  is_graded             BOOLEAN DEFAULT FALSE,
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_exercises_lesson ON training_exercises(lesson_id);

-- ── TRAINING ASSESSMENTS ─────────────────────────────────────────────────

CREATE TABLE training_assessments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id             UUID REFERENCES training_courses(id) ON DELETE CASCADE,    -- Course-level assessment
  module_id             UUID REFERENCES training_modules(id) ON DELETE CASCADE,    -- Module-level assessment
  lesson_id             UUID REFERENCES training_lessons(id) ON DELETE CASCADE,    -- Lesson-level assessment
  programme_id          UUID REFERENCES training_programmes(id) ON DELETE CASCADE, -- Final programme assessment
  title                 VARCHAR(300) NOT NULL,
  description           TEXT,
  version               VARCHAR(20) NOT NULL DEFAULT '1.0',
  status                training_content_status NOT NULL DEFAULT 'draft',
  passing_score_pct     NUMERIC(5,2),                             -- NULL = configurable later
  max_attempts          INTEGER DEFAULT 3,                        -- NULL = unlimited
  time_limit_minutes    INTEGER,                                  -- NULL = no time limit
  randomize_questions   BOOLEAN DEFAULT TRUE,
  randomize_options     BOOLEAN DEFAULT TRUE,
  show_correct_answers  BOOLEAN DEFAULT FALSE,                    -- After submission
  show_explanations     BOOLEAN DEFAULT FALSE,
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  updated_by            UUID REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  archived_at           TIMESTAMP,
  archived_by           UUID REFERENCES staff_accounts(id),
  CONSTRAINT chk_assessment_scope CHECK (
    (course_id IS NOT NULL)::int +
    (module_id IS NOT NULL)::int +
    (lesson_id IS NOT NULL)::int +
    (programme_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_training_assessments_course ON training_assessments(course_id);
CREATE INDEX idx_training_assessments_module ON training_assessments(module_id);
CREATE INDEX idx_training_assessments_lesson ON training_assessments(lesson_id);
CREATE INDEX idx_training_assessments_programme ON training_assessments(programme_id);

-- ── TRAINING QUESTIONS ───────────────────────────────────────────────────

CREATE TABLE training_questions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id         UUID NOT NULL REFERENCES training_assessments(id) ON DELETE CASCADE,
  question_text         TEXT NOT NULL,
  question_type         training_question_type NOT NULL DEFAULT 'single_choice',
  marks                 NUMERIC(6,2) NOT NULL DEFAULT 1,
  explanation           TEXT,                                     -- Shown after answer if configured
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN DEFAULT TRUE,
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_questions_assessment ON training_questions(assessment_id);
CREATE INDEX idx_training_questions_order ON training_questions(assessment_id, display_order);

-- ── TRAINING QUESTION OPTIONS ────────────────────────────────────────────

CREATE TABLE training_question_options (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id           UUID NOT NULL REFERENCES training_questions(id) ON DELETE CASCADE,
  option_text           TEXT NOT NULL,
  is_correct            BOOLEAN DEFAULT FALSE,
  display_order         INTEGER NOT NULL DEFAULT 0,
  feedback              TEXT,                                     -- Optional feedback per option
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_question_options_question ON training_question_options(question_id);

-- ── TRAINING ASSIGNMENTS ─────────────────────────────────────────────────

CREATE TABLE training_assignments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programme_id          UUID REFERENCES training_programmes(id) ON DELETE CASCADE,
  course_id             UUID REFERENCES training_courses(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_by           UUID NOT NULL REFERENCES staff_accounts(id),
  status                training_assignment_status NOT NULL DEFAULT 'assigned',
  assigned_at           TIMESTAMP DEFAULT NOW(),
  start_date            DATE,                                     -- When training becomes available
  due_date              DATE,                                     -- Deadline
  completed_at          TIMESTAMP,
  progress_pct          NUMERIC(5,2) DEFAULT 0,                   -- System-calculated
  last_activity_at      TIMESTAMP,
  cancelled_at          TIMESTAMP,
  cancelled_by          UUID REFERENCES staff_accounts(id),
  cancel_reason         TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_assignment_scope CHECK (
    (programme_id IS NOT NULL)::int + (course_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_training_assignments_employee ON training_assignments(employee_id);
CREATE INDEX idx_training_assignments_programme ON training_assignments(programme_id);
CREATE INDEX idx_training_assignments_course ON training_assignments(course_id);
CREATE INDEX idx_training_assignments_status ON training_assignments(status);
CREATE INDEX idx_training_assignments_due ON training_assignments(due_date) WHERE status IN ('assigned', 'in_progress');
CREATE INDEX idx_training_assignments_assigned_by ON training_assignments(assigned_by);

-- ── TRAINING PROGRESS (Programme/Course/Module level) ────────────────────

CREATE TABLE training_progress (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id         UUID NOT NULL REFERENCES training_assignments(id) ON DELETE CASCADE,
  programme_id          UUID REFERENCES training_programmes(id),
  course_id             UUID REFERENCES training_courses(id),
  module_id             UUID REFERENCES training_modules(id),
  progress_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  lessons_total         INTEGER NOT NULL DEFAULT 0,
  lessons_completed     INTEGER NOT NULL DEFAULT 0,
  assessments_total     INTEGER NOT NULL DEFAULT 0,
  assessments_completed INTEGER NOT NULL DEFAULT 0,
  assessments_passed    INTEGER NOT NULL DEFAULT 0,
  average_score_pct     NUMERIC(5,2),
  started_at            TIMESTAMP,
  completed_at          TIMESTAMP,
  last_activity_at      TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_progress_assignment ON training_progress(assignment_id);
CREATE INDEX idx_training_progress_employee_programme ON training_progress(assignment_id, programme_id);
CREATE UNIQUE INDEX uk_training_progress_assignment_course ON training_progress(assignment_id, course_id) WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX uk_training_progress_assignment_module ON training_progress(assignment_id, module_id) WHERE module_id IS NOT NULL;

-- ── TRAINING LESSON PROGRESS (Individual lesson completion) ──────────────

CREATE TABLE training_lesson_progress (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id         UUID NOT NULL REFERENCES training_assignments(id) ON DELETE CASCADE,
  lesson_id             UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  status                VARCHAR(20) NOT NULL DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed', 'skipped'
  progress_pct          NUMERIC(5,2) DEFAULT 0,
  time_spent_seconds    INTEGER DEFAULT 0,
  started_at            TIMESTAMP,
  completed_at          TIMESTAMP,
  last_position         JSONB,                                    -- For video: {currentTime, duration}, for doc: {page, scrollPos}
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE (assignment_id, lesson_id)
);

CREATE INDEX idx_training_lesson_progress_assignment ON training_lesson_progress(assignment_id);
CREATE INDEX idx_training_lesson_progress_lesson ON training_lesson_progress(lesson_id);

-- ── TRAINING ASSESSMENT ATTEMPTS ─────────────────────────────────────────

CREATE TABLE training_assessment_attempts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id         UUID NOT NULL REFERENCES training_assignments(id) ON DELETE CASCADE,
  assessment_id         UUID NOT NULL REFERENCES training_assessments(id) ON DELETE CASCADE,
  attempt_number        INTEGER NOT NULL DEFAULT 1,
  status                VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'graded', 'expired'
  score_pct             NUMERIC(5,2),
  total_marks           NUMERIC(6,2),
  earned_marks          NUMERIC(6,2),
  passed                BOOLEAN,
  started_at            TIMESTAMP DEFAULT NOW(),
  submitted_at          TIMESTAMP,
  graded_at             TIMESTAMP,
  graded_by             UUID REFERENCES staff_accounts(id),
  time_spent_seconds    INTEGER,
  answers               JSONB NOT NULL DEFAULT '{}',                -- {question_id: answer_data}
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE (assignment_id, assessment_id, attempt_number)
);

CREATE INDEX idx_training_attempts_assignment ON training_assessment_attempts(assignment_id);
CREATE INDEX idx_training_attempts_assessment ON training_assessment_attempts(assessment_id);
CREATE INDEX idx_training_attempts_status ON training_assessment_attempts(status);

-- ── TRAINING CERTIFICATES ────────────────────────────────────────────────

CREATE TABLE training_certificates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_number    VARCHAR(50) UNIQUE NOT NULL,              -- e.g. ET-CA-2026-00001
  assignment_id         UUID NOT NULL REFERENCES training_assignments(id) ON DELETE CASCADE,
  programme_id          UUID NOT NULL REFERENCES training_programmes(id),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  programme_version     VARCHAR(20) NOT NULL,
  issued_by             UUID NOT NULL REFERENCES staff_accounts(id),
  status                training_certificate_status NOT NULL DEFAULT 'issued',
  issued_at             TIMESTAMP DEFAULT NOW(),
  revoked_at            TIMESTAMP,
  revoked_by            UUID REFERENCES staff_accounts(id),
  revoke_reason         TEXT,
  expires_at            TIMESTAMP,                                -- For future refresher requirements
  pdf_document_id       UUID REFERENCES documents(id),            -- Generated certificate PDF
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_certificates_employee ON training_certificates(employee_id);
CREATE INDEX idx_training_certificates_programme ON training_certificates(programme_id);
CREATE INDEX idx_training_certificates_status ON training_certificates(status);

-- ── TRAINING CONTENT VERSIONS (Immutable history) ────────────────────────

CREATE TABLE training_content_versions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type           VARCHAR(50) NOT NULL,                     -- 'programme', 'course', 'module', 'lesson', 'assessment', 'question'
  entity_id             UUID NOT NULL,
  version               VARCHAR(20) NOT NULL,
  title                 VARCHAR(300),
  content_snapshot      JSONB NOT NULL,                           -- Full serialized state at this version
  change_summary        TEXT,
  created_by            UUID NOT NULL REFERENCES staff_accounts(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, version)
);

CREATE INDEX idx_training_content_versions_entity ON training_content_versions(entity_type, entity_id);
CREATE INDEX idx_training_content_versions_created ON training_content_versions(created_at);

-- ── TRAINING AUDIT LOGS ──────────────────────────────────────────────────

CREATE TABLE training_audit_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id              UUID REFERENCES staff_accounts(id),
  action                VARCHAR(100) NOT NULL,                    -- e.g. TRAINING_PROGRAMME_CREATED, TRAINING_ASSESSMENT_UPDATED
  entity_type           VARCHAR(50) NOT NULL,                     -- programme, course, module, lesson, assessment, assignment, certificate
  entity_id             UUID NOT NULL,
  entity_version        VARCHAR(20),
  old_value             JSONB,
  new_value             JSONB,
  ip_address            VARCHAR(45),
  request_id            UUID,
  metadata              JSONB,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_training_audit_staff ON training_audit_logs(staff_id, created_at DESC);
CREATE INDEX idx_training_audit_entity ON training_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_training_audit_action ON training_audit_logs(action, created_at DESC);
CREATE INDEX idx_training_audit_request ON training_audit_logs(request_id);

-- ── ROW LEVEL SECURITY PREPARATION ──────────────────────────────────────

ALTER TABLE training_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_audit_logs ENABLE ROW LEVEL SECURITY;

-- Placeholder policies (refined in application-layer authorization)
DO $$ BEGIN
  CREATE POLICY training_programmes_all ON training_programmes FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_courses_all ON training_courses FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_modules_all ON training_modules FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_lessons_all ON training_lessons FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_materials_all ON training_materials FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_exercises_all ON training_exercises FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_assessments_all ON training_assessments FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_questions_all ON training_questions FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_question_options_all ON training_question_options FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_assignments_all ON training_assignments FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_progress_all ON training_progress FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_lesson_progress_all ON training_lesson_progress FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_assessment_attempts_all ON training_assessment_attempts FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_certificates_all ON training_certificates FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_content_versions_all ON training_content_versions FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY training_audit_logs_all ON training_audit_logs FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────

CREATE TRIGGER trg_training_programmes_updated_at   BEFORE UPDATE ON training_programmes   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_courses_updated_at      BEFORE UPDATE ON training_courses      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_modules_updated_at      BEFORE UPDATE ON training_modules      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_lessons_updated_at      BEFORE UPDATE ON training_lessons      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_materials_updated_at    BEFORE UPDATE ON training_materials    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_exercises_updated_at    BEFORE UPDATE ON training_exercises    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_assessments_updated_at  BEFORE UPDATE ON training_assessments  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_questions_updated_at    BEFORE UPDATE ON training_questions    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_assignments_updated_at  BEFORE UPDATE ON training_assignments  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_progress_updated_at     BEFORE UPDATE ON training_progress     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_lesson_progress_updated BEFORE UPDATE ON training_lesson_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_assessment_attempts_upd BEFORE UPDATE ON training_assessment_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_training_certificates_updated_at BEFORE UPDATE ON training_certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at();