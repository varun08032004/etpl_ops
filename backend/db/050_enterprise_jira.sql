-- ============================================================================
-- ENTERPRISE JIRA SCHEMA - Full Jira clone for software company
-- ============================================================================

-- Custom Fields System
CREATE TYPE field_type AS ENUM ('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi_select', 'user_picker', 'multi_user_picker', 'url', 'checkbox', 'radio', 'cascade_select', 'labels');

CREATE TABLE IF NOT EXISTS custom_fields (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  type              field_type NOT NULL,
  default_value     JSONB,
  options           JSONB, -- for select/radio: [{value, label, color}]
  is_required       BOOLEAN DEFAULT FALSE,
  is_system         BOOLEAN DEFAULT FALSE, -- system fields like Story Points
  field_key         VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'cf_10001'
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_field_contexts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id          UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES task_projects(id) ON DELETE CASCADE,
  issue_type_ids    UUID[], -- empty = all issue types
  is_global         BOOLEAN DEFAULT FALSE,
  default_value     JSONB,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_id          UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value             JSONB,
  UNIQUE(issue_id, field_id)
);

CREATE INDEX idx_cf_values_issue ON custom_field_values(issue_id);
CREATE INDEX idx_cf_values_field ON custom_field_values(field_id);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  is_system         BOOLEAN DEFAULT FALSE,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_statuses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status_key        VARCHAR(50) NOT NULL, -- references task_status enum
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  category          VARCHAR(20) NOT NULL, -- 'to_do', 'in_progress', 'done'
  color             VARCHAR(7) DEFAULT '#6366f1',
  order_index       INTEGER DEFAULT 0,
  is_initial        BOOLEAN DEFAULT FALSE,
  is_final          BOOLEAN DEFAULT FALSE,
  properties        JSONB, -- {jira.issue.editable: false, etc.}
  UNIQUE(workflow_id, status_key)
);

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_status_id    UUID NOT NULL REFERENCES workflow_statuses(id) ON DELETE CASCADE,
  to_status_id      UUID NOT NULL REFERENCES workflow_statuses(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  conditions        JSONB, -- [{type: 'user_is_assignee', params: {}}, {type: 'field_value', params: {field: 'cf_10001', value: 'approved'}}]
  validators        JSONB,
  post_functions    JSONB, -- [{type: 'update_field', params: {field: 'resolution', value: 'done'}}, {type: 'send_email', params: {template: 'resolved'}}]
  screen_id         UUID, -- optional screen for transition
  order_index       INTEGER DEFAULT 0,
  UNIQUE(workflow_id, from_status_id, to_status_id)
);

CREATE TABLE IF NOT EXISTS workflow_screens (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  fields            UUID[], -- custom_field_ids in order
  operations        VARCHAR(20)[], -- create, edit, view, transition
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_workflow_schemes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  issue_type_id     UUID, -- NULL = default for all issue types
  workflow_id       UUID NOT NULL REFERENCES workflows(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, issue_type_id)
);

-- Issue Type Schemes
CREATE TABLE IF NOT EXISTS issue_type_schemes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_type_scheme_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id         UUID NOT NULL REFERENCES issue_type_schemes(id) ON DELETE CASCADE,
  issue_type        task_type NOT NULL,
  order_index       INTEGER DEFAULT 0,
  UNIQUE(scheme_id, issue_type)
);

CREATE TABLE IF NOT EXISTS project_issue_type_schemes (
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  scheme_id         UUID NOT NULL REFERENCES issue_type_schemes(id),
  PRIMARY KEY (project_id, scheme_id)
);

-- Screens & Screen Schemes
CREATE TABLE IF NOT EXISTS screens (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screen_tabs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  screen_id         UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  order_index       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS screen_tab_fields (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tab_id            UUID NOT NULL REFERENCES screen_tabs(id) ON DELETE CASCADE,
  field_id          UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  order_index       INTEGER DEFAULT 0,
  is_required       BOOLEAN DEFAULT FALSE,
  is_hidden         BOOLEAN DEFAULT FALSE
);

-- Permission Schemes
CREATE TABLE IF NOT EXISTS permission_schemes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  is_default        BOOLEAN DEFAULT FALSE,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permission_scheme_grants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id         UUID NOT NULL REFERENCES permission_schemes(id) ON DELETE CASCADE,
  permission        VARCHAR(50) NOT NULL, -- BROWSE_PROJECTS, CREATE_ISSUES, EDIT_ISSUES, DELETE_ISSUES, ASSIGN_ISSUES, RESOLVE_ISSUES, CLOSE_ISSUES, MODIFY_REPORTER, MOVE_ISSUES, LINK_ISSUES, SET_ISSUE_SECURITY, MANAGE_WATCHERS, ADD_COMMENTS, EDIT_OWN_COMMENTS, EDIT_ALL_COMMENTS, DELETE_OWN_COMMENTS, DELETE_ALL_COMMENTS, CREATE_ATTACHMENTS, DELETE_OWN_ATTACHMENTS, DELETE_ALL_ATTACHMENTS, WORK_ON_ISSUES, VIEW_VOTERS_WATCHERS, MANAGE_ISSUE_LINKS, TRANSITION_ISSUES, SCHEDULE_ISSUES
  holder_type       VARCHAR(30) NOT NULL, -- group, project_role, user, reporter, assignee, project_lead, any_logged_in_user
  holder_param      VARCHAR(255), -- group name, role id, user id
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_permission_schemes (
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  scheme_id         UUID NOT NULL REFERENCES permission_schemes(id),
  PRIMARY KEY (project_id, scheme_id)
);

-- Notification Schemes
CREATE TABLE IF NOT EXISTS notification_schemes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_scheme_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id         UUID NOT NULL REFERENCES notification_schemes(id) ON DELETE CASCADE,
  event             VARCHAR(50) NOT NULL, -- issue_created, issue_updated, issue_deleted, issue_assigned, issue_resolved, issue_closed, issue_reopened, comment_added, comment_updated, comment_deleted, attachment_added, issue_linked, issue_link_deleted, work_logged, work_updated, work_deleted, sprint_created, sprint_updated, sprint_deleted, sprint_started, sprint_closed, custom_event
  recipients        JSONB NOT NULL, -- [{type: 'group', param: 'jira-administrators'}, {type: 'project_role', param: 'developers'}, {type: 'user', param: 'reporter'}, {type: 'custom_field', param: 'cf_10001'}]
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_notification_schemes (
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  scheme_id         UUID NOT NULL REFERENCES notification_schemes(id),
  PRIMARY KEY (project_id, scheme_id)
);

-- Issue Security Schemes
CREATE TABLE IF NOT EXISTS issue_security_schemes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_security_levels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id         UUID NOT NULL REFERENCES issue_security_schemes(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  order_index       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS issue_security_level_members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id          UUID NOT NULL REFERENCES issue_security_levels(id) ON DELETE CASCADE,
  holder_type       VARCHAR(30) NOT NULL, -- group, project_role, user, reporter, assignee, project_lead
  holder_param      VARCHAR(255),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_issue_security_schemes (
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  scheme_id         UUID NOT NULL REFERENCES issue_security_schemes(id),
  PRIMARY KEY (project_id, scheme_id)
);

-- Project Roles (global)
CREATE TABLE IF NOT EXISTS project_roles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100) NOT NULL UNIQUE,
  description       TEXT,
  is_default        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Default project roles
INSERT INTO project_roles (name, description, is_default) VALUES
('Administrators', 'Full project administration', true),
('Developers', 'Can work on and transition issues', true),
('Users', 'Can browse and create issues', true)
ON CONFLICT (name) DO NOTHING;

-- Project Role Actors (who is in what role per project)
CREATE TABLE IF NOT EXISTS project_role_actors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  role_id           UUID NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
  actor_type        VARCHAR(20) NOT NULL, -- group, user
  actor_id          UUID NOT NULL, -- group_id or user_id
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, role_id, actor_type, actor_id)
);

-- Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID REFERENCES task_projects(id) ON DELETE CASCADE, -- NULL = global
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  trigger           JSONB NOT NULL, -- {type: 'issue_created', conditions: [...]}
  conditions        JSONB, -- additional conditions
  actions           JSONB NOT NULL, -- [{type: 'transition_issue', params: {status: 'In Progress'}}, {type: 'assign_issue', params: {assignee: 'reporter'}}]
  status            VARCHAR(20) DEFAULT 'enabled', -- enabled, disabled, draft
  execution_count   INTEGER DEFAULT 0,
  last_executed_at  TIMESTAMP,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id           UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_id          UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL, -- success, failed, skipped
  error_message     TEXT,
  execution_time_ms INTEGER,
  triggered_by      UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_auto_audit_rule ON automation_audit_log(rule_id);
CREATE INDEX idx_auto_audit_issue ON automation_audit_log(issue_id);

-- Agile Reports Data (pre-computed for performance)
CREATE TABLE IF NOT EXISTS sprint_reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sprint_id         UUID NOT NULL REFERENCES task_sprints(id) ON DELETE CASCADE,
  report_date       DATE NOT NULL,
  completed_points  NUMERIC(6,2) DEFAULT 0,
  committed_points  NUMERIC(6,2) DEFAULT 0,
  added_points      NUMERIC(6,2) DEFAULT 0,
  removed_points    NUMERIC(6,2) DEFAULT 0,
  completed_issues  INTEGER DEFAULT 0,
  committed_issues  INTEGER DEFAULT 0,
  UNIQUE(sprint_id, report_date)
);

CREATE TABLE IF NOT EXISTS velocity_data (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  sprint_id         UUID NOT NULL REFERENCES task_sprints(id) ON DELETE CASCADE,
  velocity_points   NUMERIC(6,2) DEFAULT 0,
  completed_issues  INTEGER DEFAULT 0,
  sprint_name       VARCHAR(150),
  sprint_start      DATE,
  sprint_end        DATE,
  UNIQUE(project_id, sprint_id)
);

CREATE TABLE IF NOT EXISTS burndown_data (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sprint_id         UUID NOT NULL REFERENCES task_sprints(id) ON DELETE CASCADE,
  report_date       DATE NOT NULL,
  remaining_points  NUMERIC(6,2) DEFAULT 0,
  ideal_remaining   NUMERIC(6,2) DEFAULT 0,
  UNIQUE(sprint_id, report_date)
);

-- Dashboards
CREATE TABLE IF NOT EXISTS dashboards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  owner_id          UUID NOT NULL REFERENCES staff_accounts(id),
  is_shared         BOOLEAN DEFAULT FALSE,
  share_permissions JSONB, -- [{type: 'group', param: 'jira-administrators'}, {type: 'project', param: 'PROJ_KEY'}]
  layout            JSONB, -- grid layout
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_gadgets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id      UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  gadget_type       VARCHAR(50) NOT NULL, -- filter_results, pie_chart, created_vs_resolved, sprint_burndown, velocity_chart, issue_statistics, activity_stream, assigned_to_me, filter_results, jira_roadmap, text
  title             VARCHAR(200),
  config            JSONB, -- gadget-specific config
  position_x        INTEGER DEFAULT 0,
  position_y        INTEGER DEFAULT 0,
  width             INTEGER DEFAULT 6,
  height            INTEGER DEFAULT 4,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Saved Filters (JQL)
CREATE TABLE IF NOT EXISTS saved_filters (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  jql               TEXT NOT NULL,
  owner_id          UUID NOT NULL REFERENCES staff_accounts(id),
  is_shared         BOOLEAN DEFAULT FALSE,
  share_permissions JSONB,
  favorite_count    INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS filter_subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filter_id         UUID NOT NULL REFERENCES saved_filters(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES staff_accounts(id),
  frequency         VARCHAR(20) NOT NULL, -- daily, weekly, monthly
  time              TIME NOT NULL,
  day_of_week       INTEGER, -- 0-6 for weekly
  day_of_month      INTEGER, -- 1-31 for monthly
  last_sent_at      TIMESTAMP,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- SLAs
CREATE TABLE IF NOT EXISTS sla_configs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  jql               TEXT NOT NULL, -- which issues this SLA applies to
  goals             JSONB NOT NULL, -- [{metric: 'time_to_first_response', time: 3600, calendar: 'business_hours'}, {metric: 'time_to_resolution', time: 28800, calendar: '24x7'}]
  is_active         BOOLEAN DEFAULT TRUE,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_calendars (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100) NOT NULL UNIQUE,
  timezone          VARCHAR(50) DEFAULT 'UTC',
  work_days         INTEGER[] DEFAULT '{1,2,3,4,5}', -- 0=Sun, 6=Sat
  work_start        TIME DEFAULT '09:00',
  work_end          TIME DEFAULT '17:00',
  holidays          JSONB, -- [{date: '2026-01-01', name: 'New Year'}]
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Default calendars
INSERT INTO sla_calendars (name, timezone, work_days, work_start, work_end) VALUES
('24x7', 'UTC', '{0,1,2,3,4,5,6}', '00:00', '23:59'),
('Business Hours', 'UTC', '{1,2,3,4,5}', '09:00', '17:00')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS sla_issue_metrics (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sla_config_id     UUID NOT NULL REFERENCES sla_configs(id) ON DELETE CASCADE,
  metric_name       VARCHAR(50) NOT NULL, -- time_to_first_response, time_to_resolution
  started_at        TIMESTAMP NOT NULL,
  paused_at         TIMESTAMP,
  breached_at       TIMESTAMP,
  completed_at      TIMESTAMP,
  elapsed_seconds   BIGINT DEFAULT 0,
  remaining_seconds BIGINT,
  is_breached       BOOLEAN DEFAULT FALSE,
  UNIQUE(issue_id, sla_config_id, metric_name)
);

-- Release Management
CREATE TABLE IF NOT EXISTS releases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  version_id        UUID REFERENCES task_versions(id) ON DELETE SET NULL,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  release_date      DATE,
  status            VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, released, archived
  release_type      VARCHAR(20) DEFAULT 'major', -- major, minor, patch, hotfix
  released_by       UUID REFERENCES staff_accounts(id),
  released_at       TIMESTAMP,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS release_issues (
  release_id        UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  issue_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  added_at          TIMESTAMP DEFAULT NOW(),
  added_by          UUID REFERENCES staff_accounts(id),
  PRIMARY KEY (release_id, issue_id)
);

-- Roadmap / Advanced Planning
CREATE TABLE IF NOT EXISTS roadmaps (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  owner_id          UUID NOT NULL REFERENCES staff_accounts(id),
  is_shared         BOOLEAN DEFAULT FALSE,
  share_permissions JSONB,
  view_config       JSONB, -- {timeframe: 'months', hierarchy: ['epic', 'story'], groupBy: 'project'}
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmap_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roadmap_id        UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  issue_id          UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES task_projects(id) ON DELETE CASCADE,
  parent_id         UUID REFERENCES roadmap_items(id) ON DELETE CASCADE,
  name              VARCHAR(300) NOT NULL,
  type              VARCHAR(20) NOT NULL, -- epic, story, initiative, theme
  start_date        DATE,
  end_date          DATE,
  progress          NUMERIC(5,2) DEFAULT 0,
  assignee_id       UUID REFERENCES employees(id) ON DELETE SET NULL,
  color             VARCHAR(7) DEFAULT '#6366f1',
  order_index       INTEGER DEFAULT 0,
  fields            JSONB, -- custom field values for display
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- OKRs
CREATE TABLE IF NOT EXISTS okrs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  owner_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  team_id           UUID REFERENCES teams(id) ON DELETE SET NULL,
  department_id     UUID REFERENCES departments(id) ON DELETE SET NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  period_type       VARCHAR(20) DEFAULT 'quarterly', -- monthly, quarterly, yearly
  status            VARCHAR(20) DEFAULT 'draft', -- draft, active, completed, archived
  progress          NUMERIC(5,2) DEFAULT 0,
  created_by        UUID REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS key_results (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  okr_id            UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  metric_type       VARCHAR(20) DEFAULT 'percentage', -- percentage, number, currency, boolean
  target_value      NUMERIC(12,2) NOT NULL,
  current_value     NUMERIC(12,2) DEFAULT 0,
  unit              VARCHAR(50),
  owner_id          UUID REFERENCES employees(id) ON DELETE SET NULL,
  status            VARCHAR(20) DEFAULT 'not_started', -- not_started, in_progress, at_risk, achieved
  progress          NUMERIC(5,2) DEFAULT 0,
  order_index       INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Triggers for updated_at
CREATE TRIGGER trg_custom_fields_updated_at BEFORE UPDATE ON custom_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dashboards_updated_at BEFORE UPDATE ON dashboards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_releases_updated_at BEFORE UPDATE ON releases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_roadmaps_updated_at BEFORE UPDATE ON roadmaps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_okrs_updated_at BEFORE UPDATE ON okrs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_key_results_updated_at BEFORE UPDATE ON key_results FOR EACH ROW EXECUTE FUNCTION update_updated_at();