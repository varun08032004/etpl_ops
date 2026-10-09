-- Jira-like Task Tracker with Teams, Departments, Sprints, Labels, Components, Versions
-- Replaces 041_tasks_tracker.sql

CREATE TABLE IF NOT EXISTS task_projects (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id     UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_id           UUID REFERENCES teams(id) ON DELETE SET NULL,
  name              VARCHAR(150) NOT NULL,
  key_prefix        VARCHAR(10) NOT NULL,
  description       TEXT,
  project_lead_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  project_type      VARCHAR(20) DEFAULT 'software', -- software, business, service_desk
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_id, key_prefix)
);

CREATE TABLE IF NOT EXISTS task_project_members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role              VARCHAR(30) DEFAULT 'member', -- lead, admin, member, viewer
  added_at          TIMESTAMP DEFAULT NOW(),
  added_by          UUID REFERENCES staff_accounts(id),
  UNIQUE(project_id, employee_id)
);

CREATE TABLE IF NOT EXISTS task_versions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  start_date        DATE,
  release_date      DATE,
  status            VARCHAR(20) DEFAULT 'unreleased', -- unreleased, released, archived
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_components (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  lead_id           UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS task_sprints (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  goal              TEXT,
  start_date        DATE,
  end_date          DATE,
  status            VARCHAR(20) DEFAULT 'planning', -- planning, active, completed
  complete_date     TIMESTAMP,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TYPE task_type AS ENUM ('task', 'bug', 'story', 'epic', 'subtask');
CREATE TYPE task_priority AS ENUM ('lowest', 'low', 'medium', 'high', 'highest');
CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled');

CREATE TABLE IF NOT EXISTS tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  sprint_id         UUID REFERENCES task_sprints(id) ON DELETE SET NULL,
  parent_task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  issue_key         VARCHAR(30) NOT NULL UNIQUE,
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  type              task_type DEFAULT 'task',
  priority          task_priority DEFAULT 'medium',
  status            task_status DEFAULT 'backlog',
  assignee_id       UUID REFERENCES employees(id) ON DELETE SET NULL,
  reporter_id       UUID REFERENCES employees(id) ON DELETE SET NULL,
  story_points      NUMERIC(5,2),
  due_date          DATE,
  original_estimate NUMERIC(6,2), -- hours
  remaining_estimate NUMERIC(6,2),
  time_spent        NUMERIC(6,2) DEFAULT 0,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP,
  resolution        VARCHAR(50), -- fixed, wont_fix, duplicate, cannot_reproduce
  resolved_at       TIMESTAMP
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_sprint ON tasks(sprint_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_issue_key ON tasks(issue_key);

-- Task labels (many-to-many)
CREATE TABLE IF NOT EXISTS task_labels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  name              VARCHAR(50) NOT NULL,
  color             VARCHAR(7) DEFAULT '#6366f1', -- hex color
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS task_task_labels (
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id          UUID NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- Task components (many-to-many)
CREATE TABLE IF NOT EXISTS task_task_components (
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  component_id      UUID NOT NULL REFERENCES task_components(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, component_id)
);

-- Fix versions (many-to-many)
CREATE TABLE IF NOT EXISTS task_fix_versions (
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version_id        UUID NOT NULL REFERENCES task_versions(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, version_id)
);

-- Affects versions (many-to-many)
CREATE TABLE IF NOT EXISTS task_affects_versions (
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version_id        UUID NOT NULL REFERENCES task_versions(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, version_id)
);

-- Task watchers
CREATE TABLE IF NOT EXISTS task_watchers (
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  added_at          TIMESTAMP DEFAULT NOW(),
  added_by          UUID REFERENCES staff_accounts(id),
  PRIMARY KEY (task_id, employee_id)
);

-- Task votes
CREATE TABLE IF NOT EXISTS task_votes (
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  voted_at          TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (task_id, employee_id)
);

-- Task attachments
CREATE TABLE IF NOT EXISTS task_attachments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename          VARCHAR(255) NOT NULL,
  storage_path      VARCHAR(500) NOT NULL,
  file_size         BIGINT NOT NULL,
  mime_type         VARCHAR(100),
  uploaded_by       UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Task comments with rich content
CREATE TABLE IF NOT EXISTS task_comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES staff_accounts(id),
  content           TEXT NOT NULL,
  content_json      JSONB, -- for rich text editors
  is_internal       BOOLEAN DEFAULT FALSE, -- internal notes vs public comments
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_author ON task_comments(author_id);

-- Activity/History log
CREATE TABLE IF NOT EXISTS task_activity (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id         UUID REFERENCES staff_accounts(id),
  field_changed     VARCHAR(50), -- status, assignee, priority, etc.
  old_value         TEXT,
  new_value         TEXT,
  change_type       VARCHAR(20), -- field_change, comment, attachment, link, sprint_change
  description       TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_activity_task ON task_activity(task_id);
CREATE INDEX idx_task_activity_created ON task_activity(created_at);

-- Task links (blocked by, blocks, relates to, duplicates, cloned from)
CREATE TYPE link_type AS ENUM ('blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicated_by', 'cloned_from', 'clones');

CREATE TABLE IF NOT EXISTS task_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type         link_type NOT NULL,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_task_id, target_task_id, link_type)
);

-- Triggers for updated_at
CREATE TRIGGER trg_task_projects_updated_at
  BEFORE UPDATE ON task_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_project_members_updated_at
  BEFORE UPDATE ON task_project_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_versions_updated_at
  BEFORE UPDATE ON task_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_components_updated_at
  BEFORE UPDATE ON task_components FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_sprints_updated_at
  BEFORE UPDATE ON task_sprints FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_labels_updated_at
  BEFORE UPDATE ON task_labels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();