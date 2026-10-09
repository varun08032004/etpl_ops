const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
    max: 1,
    statement_timeout: 5000,
});

const enums = [
    { name: 'issue_type', values: "('epic', 'story', 'task', 'bug', 'subtask', 'incident', 'problem', 'change', 'service_request')" },
    { name: 'issue_priority', values: "('lowest', 'low', 'medium', 'high', 'highest')" },
    { name: 'issue_status_category', values: "('to_do', 'in_progress', 'done')" },
    { name: 'sprint_status', values: "('planning', 'active', 'completed', 'closed')" },
    { name: 'workflow_transition_type', values: "('global', 'directed')" },
    { name: 'permission_type', values: "('browse_project', 'create_issues', 'edit_issues', 'delete_issues', 'assign_issues', 'resolve_issues', 'close_issues', 'reopen_issues', 'transition_issues', 'schedule_issues', 'move_issues', 'link_issues', 'set_issue_security', 'manage_watchers', 'add_comments', 'edit_own_comments', 'edit_all_comments', 'delete_own_comments', 'delete_all_comments', 'create_attachments', 'delete_own_attachments', 'delete_all_attachments', 'work_on_issues', 'view_voters_watchers', 'manage_issue_links', 'bulk_change', 'manage_sprints', 'view_dev_tools', 'manage_versions', 'manage_components', 'manage_versions', 'manage_reports', 'administer_projects')" },
    { name: 'jira_link_type', values: "('blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicated_by', 'clones', 'cloned_from', 'parent_of', 'child_of', 'relates_to')" },
    { name: 'board_type', values: "('scrum', 'kanban')" },
    { name: 'custom_field_type', values: "('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi_select', 'user_picker', 'multi_user_picker', 'group_picker', 'project_picker', 'version_picker', 'component_picker', 'label', 'url', 'checkbox', 'radio', 'cascade_select', 'date_range', 'time', 'currency', 'percentage')" },
];

async function createEnums() {
    const client = await pool.connect();
    try {
        for (const e of enums) {
            try {
                console.log(`Creating ${e.name}...`);
                await pool.query(`CREATE TYPE ${e.name} AS ENUM ${e.values}`);
                console.log(`${e.name} created successfully`);
            } catch (err) {
                if (err.code === '42710') {
                    console.log(`${e.name} already exists, skipping`);
                } else {
                    console.error(`Error creating ${e.name}:`, err.code, err.message);
                }
            }
        }
        
        console.log('All enum types processed');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

createEnums();

// Force exit after 10 seconds
setTimeout(() => {
    console.log('Timeout - forcing exit');
    process.exit(1);
}, 15000);