-- Collaborative Workspaces (Google Workspace-like)
CREATE TABLE IF NOT EXISTS workspaces (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id     UUID REFERENCES departments(id) ON DELETE SET NULL,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  is_public         BOOLEAN DEFAULT FALSE,  -- if true, all employees can see
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role              VARCHAR(20) DEFAULT 'member',  -- owner, editor, viewer
  joined_at         TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, employee_id)
);

CREATE TABLE IF NOT EXISTS workspace_docs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title             VARCHAR(255) NOT NULL,
  content           JSONB,  -- stores collaborative editor content (e.g., TipTap/ProseMirror JSON)
  version           INTEGER DEFAULT 1,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workspace_docs_workspace ON workspace_docs(workspace_id);

-- Triggers for updated_at
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workspace_docs_updated_at
  BEFORE UPDATE ON workspace_docs FOR EACH ROW EXECUTE FUNCTION update_updated_at();