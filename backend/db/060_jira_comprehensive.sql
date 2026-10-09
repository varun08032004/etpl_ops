-- ============================================================================
-- COMPREHENSIVE JIRA-LIKE SCHEMA
-- Full Jira clone with Projects, Issues, Sprints, Workflows, Reports, etc.
-- ============================================================================

-- ============================================================================
-- ENUMS (created conditionally to avoid conflicts)
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_type') THEN
        CREATE TYPE project_type AS ENUM ('software', 'business', 'service_desk');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_type') THEN
        CREATE TYPE issue_type AS ENUM ('epic', 'story', 'task', 'bug', 'subtask', 'incident', 'problem', 'change', 'service_request');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_priority') THEN
        CREATE TYPE issue_priority AS ENUM ('lowest', 'low', 'medium', 'high', 'highest');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status_category') THEN
        CREATE TYPE issue_status_category AS ENUM ('to_do', 'in_progress', 'done');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sprint_status') THEN
        CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'completed', 'closed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_transition_type') THEN
        CREATE TYPE workflow_transition_type AS ENUM ('global', 'directed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_type') THEN
        CREATE TYPE permission_type AS ENUM (
            'browse_project', 'create_issues', 'edit_issues', 'delete_issues',
            'assign_issues', 'resolve_issues', 'close_issues', 'reopen_issues',
            'transition_issues', 'schedule_issues', 'move_issues', 'link_issues',
            'set_issue_security', 'manage_watchers', 'add_comments', 'edit_own_comments',
            'edit_all_comments', 'delete_own_comments', 'delete_all_comments',
            'create_attachments', 'delete_own_attachments', 'delete_all_attachments',
            'work_on_issues', 'view_voters_watchers', 'manage_issue_links',
            'bulk_change', 'manage_sprints', 'view_dev_tools', 'manage_versions',
            'manage_components', 'manage_versions', 'manage_reports', 'administer_projects'
        );
    END IF;
END $$;

-- Using existing link_type enum instead of creating jira_link_type
-- link_type already exists with: blocks, blocked_by, relates_to, duplicates, duplicated_by, clones, cloned_from

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'board_type') THEN
        CREATE TYPE board_type AS ENUM ('scrum', 'kanban');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type') THEN
        CREATE TYPE custom_field_type AS ENUM (
            'text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi_select',
            'user_picker', 'multi_user_picker', 'group_picker', 'project_picker',
            'version_picker', 'component_picker', 'label', 'url', 'checkbox', 'radio',
            'cascade_select', 'date_range', 'time', 'currency', 'percentage'
        );
    END IF;
END $$;

-- ============================================================================
-- BASE LOOKUP TABLES (Issue Types, Statuses, Priorities, Resolutions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_issue_types (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_id     VARCHAR(50),
    color       VARCHAR(7),
    is_system   BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_issue_statuses (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category    issue_status_category NOT NULL,
    color       VARCHAR(7) DEFAULT '#6366f1',
    is_system   BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_priorities (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon_color  VARCHAR(7),
    is_system   BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_resolutions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Default issue types
INSERT INTO jira_issue_types (name, description, icon_id, color, is_system, order_index) VALUES
('Epic', 'A large body of work that can be broken down into smaller tasks', 'epic', '#7c3aed', true, 0),
('Story', 'A user story representing a feature request', 'story', '#059669', true, 1),
('Task', 'A task that needs to be done', 'task', '#2563eb', true, 2),
('Bug', 'A problem that impairs or prevents the functions of the product', 'bug', '#dc2626', true, 3),
('Subtask', 'A smaller piece of work that is part of a larger task', 'subtask', '#64748b', true, 4),
('Incident', 'An unplanned interruption to a service', 'incident', '#ea580c', true, 5),
('Problem', 'The underlying cause of one or more incidents', 'problem', '#c2410c', true, 6),
('Change', 'A proposal to modify a service or infrastructure', 'change', '#7c2d12', true, 7),
('Service Request', 'A request for a service from a user', 'service_request', '#166534', true, 8)
ON CONFLICT (name) DO NOTHING;

-- Default issue statuses
INSERT INTO jira_issue_statuses (name, description, category, color, is_system, order_index) VALUES
('Backlog', 'Issues that are not yet ready for work', 'to_do', '#9ca3af', true, 0),
('To Do', 'Issues ready to be worked on', 'to_do', '#6366f1', true, 1),
('In Progress', 'Issues currently being worked on', 'in_progress', '#3b82f6', true, 2),
('In Review', 'Issues waiting for review', 'in_progress', '#8b5cf6', true, 3),
('Done', 'Issues that have been completed', 'done', '#22c55e', true, 4)
ON CONFLICT (name) DO NOTHING;

-- Default priorities
INSERT INTO jira_priorities (name, description, icon_color, is_system, order_index) VALUES
('Lowest', 'Lowest priority', '#9ca3af', true, 0),
('Low', 'Low priority', '#6b7280', true, 1),
('Medium', 'Medium priority', '#3b82f6', true, 2),
('High', 'High priority', '#f59e0b', true, 3),
('Highest', 'Highest priority', '#ef4444', true, 4)
ON CONFLICT (name) DO NOTHING;

-- Default resolutions
INSERT INTO jira_resolutions (name, description, is_system) VALUES
('Done', 'Work has been completed', true),
('Won''t Do', 'Work will not be done', true),
('Duplicate', 'This is a duplicate of another issue', true),
('Cannot Reproduce', 'The issue cannot be reproduced', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_projects (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key               VARCHAR(10) NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    project_type      project_type DEFAULT 'software',
    lead_id           UUID REFERENCES employees(id),
    default_assignee  UUID REFERENCES employees(id),
    url               VARCHAR(500),
    is_private        BOOLEAN DEFAULT FALSE,
    avatar_id         UUID,
    category_id       UUID,
    created_by        UUID REFERENCES staff_accounts(id),
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),
    archived_at       TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jira_project_categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_project_members (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    role_id           UUID NOT NULL REFERENCES jira_project_roles(id),
    added_by          UUID REFERENCES staff_accounts(id),
    added_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, employee_id)
);

CREATE TABLE IF NOT EXISTS jira_project_roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_default  BOOLEAN DEFAULT FALSE,
    is_system   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO jira_project_roles (name, description, is_default, is_system) VALUES
('Administrators', 'Full project administration permissions', true, true),
('Developers', 'Can work on and transition issues', true, true),
('Users', 'Can browse and create issues', true, true),
('Viewers', 'Read-only access to project', false, false)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PROJECT ISSUE TYPES, STATUSES, PRIORITIES (per-project configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_project_issue_types (
    project_id    UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    issue_type_id UUID NOT NULL REFERENCES jira_issue_types(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, issue_type_id)
);

CREATE TABLE IF NOT EXISTS jira_project_statuses (
    project_id  UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    status_id   UUID NOT NULL REFERENCES jira_issue_statuses(id) ON DELETE CASCADE,
    rank        INTEGER DEFAULT 0,
    PRIMARY KEY (project_id, status_id)
);

-- ============================================================================
-- VERSIONS & COMPONENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    start_date      DATE,
    release_date    DATE,
    status          VARCHAR(20) DEFAULT 'unreleased',
    released_by     UUID REFERENCES staff_accounts(id),
    released_at     TIMESTAMP,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_components (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    lead_id         UUID REFERENCES employees(id),
    default_assignee_type VARCHAR(20) DEFAULT 'project_default',
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, name)
);

-- ============================================================================
-- ISSUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_issues (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    issue_type_id       UUID NOT NULL REFERENCES jira_issue_types(id),
    status_id           UUID NOT NULL REFERENCES jira_issue_statuses(id),
    priority_id         UUID REFERENCES jira_priorities(id),
    resolution_id       UUID REFERENCES jira_resolutions(id),
    parent_id           UUID REFERENCES jira_issues(id) ON DELETE SET NULL,
    epic_id             UUID REFERENCES jira_issues(id) ON DELETE SET NULL,
    issue_key           VARCHAR(30) NOT NULL UNIQUE,
    summary             VARCHAR(300) NOT NULL,
    description         TEXT,
    description_adf     JSONB,
    reporter_id         UUID NOT NULL REFERENCES employees(id),
    assignee_id         UUID REFERENCES employees(id),
    creator_id          UUID REFERENCES staff_accounts(id),
    story_points        NUMERIC(5,2),
    original_estimate   NUMERIC(6,2),
    remaining_estimate  NUMERIC(6,2),
    time_spent          NUMERIC(6,2) DEFAULT 0,
    due_date            DATE,
    start_date          DATE,
    due_date_adf        JSONB,
    security_level_id   UUID,
    environment         TEXT,
    affected_versions   UUID[],
    fix_versions        UUID[],
    components          UUID[],
    labels              TEXT[],
    rank                NUMERIC(20,4) DEFAULT 0,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    resolved_at         TIMESTAMP,
    closed_at           TIMESTAMP,
    archived_at         TIMESTAMP,
    sprint_id           UUID
);

CREATE INDEX idx_jira_issues_project ON jira_issues(project_id);
CREATE INDEX idx_jira_issues_epic ON jira_issues(epic_id);
CREATE INDEX idx_jira_issues_assignee ON jira_issues(assignee_id);
CREATE INDEX idx_jira_issues_reporter ON jira_issues(reporter_id);
CREATE INDEX idx_jira_issues_status ON jira_issues(status_id);
CREATE INDEX idx_jira_issues_type ON jira_issues(issue_type_id);
CREATE INDEX idx_jira_issues_priority ON jira_issues(priority_id);
CREATE INDEX idx_jira_issues_parent ON jira_issues(parent_id);
CREATE INDEX idx_jira_issues_rank ON jira_issues(rank);
CREATE INDEX idx_jira_issues_key ON jira_issues(issue_key);
CREATE INDEX idx_jira_issues_sprint ON jira_issues(sprint_id);

-- ============================================================================
-- ISSUE RELATIONS (links) - using existing link_type enum
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_issue_links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_issue_id UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    target_issue_id UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    link_type       link_type NOT NULL,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_issue_id, target_issue_id, link_type)
);

CREATE INDEX idx_jira_links_source ON jira_issue_links(source_issue_id);
CREATE INDEX idx_jira_links_target ON jira_issue_links(target_issue_id);

-- ============================================================================
-- ISSUE ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id        UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(100),
    storage_path    VARCHAR(500) NOT NULL,
    thumbnail_path  VARCHAR(500),
    width           INTEGER,
    height          INTEGER,
    uploaded_by     UUID NOT NULL REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jira_attachments_issue ON jira_attachments(issue_id);

-- ============================================================================
-- ISSUE COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id        UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES staff_accounts(id),
    body            TEXT NOT NULL,
    body_adf        JSONB,
    is_internal     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_jira_comments_issue ON jira_comments(issue_id);
CREATE INDEX idx_jira_comments_author ON jira_comments(author_id);

-- ============================================================================
-- ISSUE WORKLOG (Time Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_worklogs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id        UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES staff_accounts(id),
    time_spent      NUMERIC(6,2) NOT NULL,
    time_spent_sec  INTEGER NOT NULL,
    comment         TEXT,
    comment_adf     JSONB,
    started_at      TIMESTAMP NOT NULL,
    logged_at       TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jira_worklogs_issue ON jira_worklogs(issue_id);
CREATE INDEX idx_jira_worklogs_author ON jira_worklogs(author_id);

-- ============================================================================
-- ISSUE WATCHERS & VOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_watchers (
    issue_id    UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    added_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (issue_id, employee_id)
);

CREATE TABLE IF NOT EXISTS jira_votes (
    issue_id    UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    voted_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (issue_id, employee_id)
);

-- ============================================================================
-- ISSUE ACTIVITY/HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_issue_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id        UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES staff_accounts(id),
    field_changed   VARCHAR(100),
    old_value       TEXT,
    new_value       TEXT,
    change_type     VARCHAR(30),
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jira_history_issue ON jira_issue_history(issue_id);
CREATE INDEX idx_jira_history_created ON jira_issue_history(created_at);

-- ============================================================================
-- SPRINTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_sprints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    board_id        UUID,
    name            VARCHAR(150) NOT NULL,
    goal            TEXT,
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(20) DEFAULT 'planning',
    complete_date   TIMESTAMP,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE jira_issues ADD CONSTRAINT fk_jira_issues_sprint 
    FOREIGN KEY (sprint_id) REFERENCES jira_sprints(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS jira_sprint_issues (
    sprint_id   UUID NOT NULL REFERENCES jira_sprints(id) ON DELETE CASCADE,
    issue_id    UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    added_at    TIMESTAMP DEFAULT NOW(),
    added_by    UUID REFERENCES staff_accounts(id),
    removed_at  TIMESTAMP,
    removed_by  UUID REFERENCES staff_accounts(id),
    PRIMARY KEY (sprint_id, issue_id)
);

CREATE INDEX idx_sprint_issues_sprint ON jira_sprint_issues(sprint_id);
CREATE INDEX idx_sprint_issues_issue ON jira_sprint_issues(issue_id);

-- ============================================================================
-- BOARDS (Kanban/Scrum)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_boards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    type            board_type DEFAULT 'scrum',
    description     TEXT,
    filter_jql      TEXT,
    column_config   JSONB,
    swimlane_config JSONB,
    estimation_field VARCHAR(20) DEFAULT 'story_points',
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_board_columns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES jira_boards(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    status_ids      UUID[],
    min_issues      INTEGER,
    max_issues      INTEGER,
    rank            INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_board_swimlanes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES jira_boards(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    query_jql       TEXT,
    rank            INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_quick_filters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES jira_boards(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    jql             TEXT NOT NULL,
    color           VARCHAR(7),
    rank            INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- WORKFLOWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    is_system       BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_workflow_statuses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID NOT NULL REFERENCES jira_workflows(id) ON DELETE CASCADE,
    status_id       UUID NOT NULL REFERENCES jira_issue_statuses(id) ON DELETE CASCADE,
    order_index     INTEGER DEFAULT 0,
    properties      JSONB,
    UNIQUE(workflow_id, status_id)
);

CREATE TABLE IF NOT EXISTS jira_workflow_transitions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id         UUID NOT NULL REFERENCES jira_workflows(id) ON DELETE CASCADE,
    from_status_id      UUID NOT NULL REFERENCES jira_issue_statuses(id) ON DELETE CASCADE,
    to_status_id        UUID NOT NULL REFERENCES jira_issue_statuses(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    conditions          JSONB,
    validators          JSONB,
    post_functions      JSONB,
    screen_id           UUID,
    order_index         INTEGER DEFAULT 0,
    UNIQUE(workflow_id, from_status_id, to_status_id)
);

CREATE TABLE IF NOT EXISTS jira_workflow_schemes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    default_workflow_id UUID REFERENCES jira_workflows(id),
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_workflow_scheme_mappings (
    scheme_id       UUID NOT NULL REFERENCES jira_workflow_schemes(id) ON DELETE CASCADE,
    issue_type_id   UUID NOT NULL REFERENCES jira_issue_types(id) ON DELETE CASCADE,
    workflow_id     UUID NOT NULL REFERENCES jira_workflows(id) ON DELETE CASCADE,
    PRIMARY KEY (scheme_id, issue_type_id)
);

CREATE TABLE IF NOT EXISTS jira_project_workflow_schemes (
    project_id UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    scheme_id  UUID NOT NULL REFERENCES jira_workflow_schemes(id),
    PRIMARY KEY (project_id, scheme_id)
);

-- ============================================================================
-- CUSTOM FIELDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_custom_fields (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(150) NOT NULL,
    description         TEXT,
    type                custom_field_type NOT NULL,
    default_value       JSONB,
    options             JSONB,
    is_required         BOOLEAN DEFAULT FALSE,
    is_system           BOOLEAN DEFAULT FALSE,
    field_key           VARCHAR(50) UNIQUE NOT NULL,
    searcher_type       VARCHAR(50),
    created_by          UUID REFERENCES staff_accounts(id),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_custom_field_contexts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id        UUID NOT NULL REFERENCES jira_custom_fields(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES jira_projects(id) ON DELETE CASCADE,
    issue_type_ids  UUID[],
    is_global       BOOLEAN DEFAULT FALSE,
    default_value   JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_custom_field_values (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id        UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES jira_custom_fields(id) ON DELETE CASCADE,
    value           JSONB,
    UNIQUE(issue_id, field_id)
);

-- ============================================================================
-- SCREENS & SCREEN SCHEMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_screens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_screen_tabs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    screen_id       UUID NOT NULL REFERENCES jira_screens(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    order_index     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS jira_screen_tab_fields (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tab_id          UUID NOT NULL REFERENCES jira_screen_tabs(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES jira_custom_fields(id) ON DELETE CASCADE,
    order_index     INTEGER DEFAULT 0,
    is_required     BOOLEAN DEFAULT FALSE,
    is_hidden       BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS jira_screen_schemes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_screen_scheme_mappings (
    scheme_id       UUID NOT NULL REFERENCES jira_screen_schemes(id) ON DELETE CASCADE,
    operation       VARCHAR(50) NOT NULL,
    screen_id       UUID NOT NULL REFERENCES jira_screens(id) ON DELETE CASCADE,
    transition_id   UUID REFERENCES jira_workflow_transitions(id),
    PRIMARY KEY (scheme_id, operation, transition_id)
);

CREATE TABLE IF NOT EXISTS jira_project_screen_schemes (
    project_id UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    scheme_id  UUID NOT NULL REFERENCES jira_screen_schemes(id),
    PRIMARY KEY (project_id, scheme_id)
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_notification_schemes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_notification_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheme_id       UUID NOT NULL REFERENCES jira_notification_schemes(id) ON DELETE CASCADE,
    event           VARCHAR(50) NOT NULL,
    recipients      JSONB NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_project_notification_schemes (
    project_id UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    scheme_id  UUID NOT NULL REFERENCES jira_notification_schemes(id),
    PRIMARY KEY (project_id, scheme_id)
);

-- ============================================================================
-- REPORTS DATA (pre-computed for performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_sprint_reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sprint_id           UUID NOT NULL REFERENCES jira_sprints(id) ON DELETE CASCADE,
    report_date         DATE NOT NULL,
    completed_points    NUMERIC(6,2) DEFAULT 0,
    committed_points    NUMERIC(6,2) DEFAULT 0,
    added_points        NUMERIC(6,2) DEFAULT 0,
    removed_points      NUMERIC(6,2) DEFAULT 0,
    completed_issues    INTEGER DEFAULT 0,
    committed_issues    INTEGER DEFAULT 0,
    UNIQUE(sprint_id, report_date)
);

CREATE TABLE IF NOT EXISTS jira_velocity_data (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    sprint_id           UUID NOT NULL REFERENCES jira_sprints(id) ON DELETE CASCADE,
    velocity_points     NUMERIC(6,2) DEFAULT 0,
    completed_issues    INTEGER DEFAULT 0,
    sprint_name         VARCHAR(150),
    sprint_start        DATE,
    sprint_end          DATE,
    UNIQUE(project_id, sprint_id)
);

CREATE TABLE IF NOT EXISTS jira_burndown_data (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sprint_id           UUID NOT NULL REFERENCES jira_sprints(id) ON DELETE CASCADE,
    report_date         DATE NOT NULL,
    remaining_points    NUMERIC(6,2) DEFAULT 0,
    ideal_remaining     NUMERIC(6,2) DEFAULT 0,
    UNIQUE(sprint_id, report_date)
);

CREATE TABLE IF NOT EXISTS jira_control_chart_data (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    issue_id            UUID NOT NULL REFERENCES jira_issues(id) ON DELETE CASCADE,
    status_id           UUID NOT NULL REFERENCES jira_issue_statuses(id),
    entered_at          TIMESTAMP NOT NULL,
    exited_at           TIMESTAMP,
    cycle_time_hours    NUMERIC(10,2),
    lead_time_hours     NUMERIC(10,2),
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_cumulative_flow_data (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    status_id           UUID NOT NULL REFERENCES jira_issue_statuses(id),
    report_date         DATE NOT NULL,
    issue_count         INTEGER DEFAULT 0,
    UNIQUE(project_id, status_id, report_date)
);

-- ============================================================================
-- ISSUE SECURITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS jira_issue_security_schemes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    created_by      UUID REFERENCES staff_accounts(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_issue_security_levels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheme_id       UUID NOT NULL REFERENCES jira_issue_security_schemes(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    order_index     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS jira_issue_security_level_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level_id        UUID NOT NULL REFERENCES jira_issue_security_levels(id) ON DELETE CASCADE,
    holder_type     VARCHAR(30) NOT NULL,
    holder_param    VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jira_project_issue_security_schemes (
    project_id UUID NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    scheme_id  UUID NOT NULL REFERENCES jira_issue_security_schemes(id),
    PRIMARY KEY (project_id, scheme_id)
);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW jira_issues_detailed AS
SELECT 
    i.id, i.project_id, i.issue_type_id, i.status_id, i.priority_id, i.resolution_id,
    i.parent_id, i.epic_id, i.issue_key, i.summary, i.description, i.description_adf,
    i.reporter_id, i.assignee_id, i.creator_id, i.story_points, i.original_estimate,
    i.remaining_estimate, i.time_spent, i.due_date, i.start_date, i.due_date_adf,
    i.security_level_id, i.environment, i.affected_versions, i.fix_versions,
    i.components, i.labels, i.rank, i.created_at, i.updated_at, i.resolved_at,
    i.closed_at, i.archived_at, i.sprint_id,
    p.key as project_key,
    p.name as project_name,
    it.name as issue_type_name,
    it.color as issue_type_color,
    it.icon_id as issue_type_icon,
    s.name as status_name,
    s.category as status_category,
    s.color as status_color,
    pr.name as priority_name,
    pr.icon_color as priority_color,
    r.name as resolution_name,
    e1.full_name as assignee_name,
    e1.work_email as assignee_email,
    e2.full_name as reporter_name,
    e2.work_email as reporter_email,
    ep.issue_key as epic_key,
    ep.summary as epic_summary,
    sp.name as sprint_name,
    sp.status as sprint_status
FROM jira_issues i
JOIN jira_projects p ON p.id = i.project_id
JOIN jira_issue_types it ON it.id = i.issue_type_id
JOIN jira_issue_statuses s ON s.id = i.status_id
LEFT JOIN jira_priorities pr ON pr.id = i.priority_id
LEFT JOIN jira_resolutions r ON r.id = i.resolution_id
LEFT JOIN employees e1 ON e1.id = i.assignee_id
LEFT JOIN employees e2 ON e2.id = i.reporter_id
LEFT JOIN jira_issues ep ON ep.id = i.epic_id
LEFT JOIN jira_sprints sp ON sp.id = i.sprint_id;

CREATE OR REPLACE VIEW jira_sprint_issues_detailed AS
SELECT 
    si.sprint_id,
    si.added_at,
    si.added_by,
    si.removed_at,
    si.removed_by,
    sp.name as sprint_name,
    sp.status as sprint_status,
    sp.start_date as sprint_start_date,
    sp.end_date as sprint_end_date,
    i.id, i.project_id, i.issue_type_id, i.status_id, i.priority_id, i.resolution_id,
    i.parent_id, i.epic_id, i.issue_key, i.summary, i.description, i.description_adf,
    i.reporter_id, i.assignee_id, i.creator_id, i.story_points, i.original_estimate,
    i.remaining_estimate, i.time_spent, i.due_date, i.start_date as issue_start_date, i.due_date_adf,
    i.security_level_id, i.environment, i.affected_versions, i.fix_versions,
    i.components, i.labels, i.rank, i.created_at, i.updated_at, i.resolved_at,
    i.closed_at, i.archived_at,
    it.name as issue_type_name,
    s.name as status_name,
    s.category as status_category,
    pr.name as priority_name,
    e.full_name as assignee_name
FROM jira_sprint_issues si
JOIN jira_sprints sp ON sp.id = si.sprint_id
JOIN jira_issues i ON i.id = si.issue_id
JOIN jira_issue_types it ON it.id = i.issue_type_id
JOIN jira_issue_statuses s ON s.id = i.status_id
LEFT JOIN jira_priorities pr ON pr.id = i.priority_id
LEFT JOIN employees e ON e.id = i.assignee_id
WHERE si.removed_at IS NULL;

CREATE OR REPLACE VIEW jira_project_velocity AS
SELECT 
    v.project_id,
    v.sprint_id,
    sp.name as sprint_name,
    sp.start_date,
    sp.end_date,
    v.velocity_points,
    v.completed_issues,
    ROW_NUMBER() OVER (PARTITION BY v.project_id ORDER BY sp.start_date DESC) as sprint_number
FROM jira_velocity_data v
JOIN jira_sprints sp ON sp.id = v.sprint_id
WHERE sp.status = 'completed'
ORDER BY v.project_id, sp.start_date DESC;