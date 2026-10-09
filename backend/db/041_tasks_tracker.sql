-- Department Tasks / Issues (Jira-like)
CREATE TABLE IF NOT EXISTS task_projects (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id     UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  key_prefix        VARCHAR(10) NOT NULL,  -- e.g. "FIN", "HR", "ENG"
  description       TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_id, key_prefix)
);

CREATE TABLE IF NOT EXISTS task_sprints (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  goal              TEXT,
  start_date        DATE,
  end_date          DATE,
  status            VARCHAR(20) DEFAULT 'planning',  -- planning, active, completed
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
  parent_task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- for subtasks
  issue_key         VARCHAR(30) NOT NULL UNIQUE,  -- e.g. "FIN-123"
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  type              task_type DEFAULT 'task',
  priority          task_priority DEFAULT 'medium',
  status            task_status DEFAULT 'backlog',
  assignee_id       UUID REFERENCES employees(id) ON DELETE SET NULL,
  reporter_id       UUID REFERENCES employees(id) ON DELETE SET NULL,
  story_points      NUMERIC(5,2),
  due_date          DATE,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_sprint ON tasks(sprint_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS task_comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES staff_accounts(id),
  content           TEXT NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);

-- Triggers for updated_at
CREATE TRIGGER trg_task_projects_updated_at
  BEFORE UPDATE ON task_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_sprints_updated_at
  BEFORE UPDATE ON task_sprints FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();