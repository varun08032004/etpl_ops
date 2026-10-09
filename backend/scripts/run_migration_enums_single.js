const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
});

const enumBlocks = [
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_type') THEN
        CREATE TYPE project_type AS ENUM ('software', 'business', 'service_desk');
    END IF;
END $$;`,
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_type') THEN
        CREATE TYPE issue_type AS ENUM ('epic', 'story', 'task', 'bug', 'subtask', 'incident', 'problem', 'change', 'service_request');
    END IF;
END $$;`,
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_priority') THEN
        CREATE TYPE issue_priority AS ENUM ('lowest', 'low', 'medium', 'high', 'highest');
    END IF;
END $$;`,
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status_category') THEN
        CREATE TYPE issue_status_category AS ENUM ('to_do', 'in_progress', 'done');
    END IF;
END $$;`,
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sprint_status') THEN
        CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'completed', 'closed');
    END IF;
END $$;`,
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_transition_type') THEN
        CREATE TYPE workflow_transition_type AS ENUM ('global', 'directed');
    END IF;
END $$;`,
    `DO $$ BEGIN
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
END $$;`,
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'board_type') THEN
        CREATE TYPE board_type AS ENUM ('scrum', 'kanban');
    END IF;
END $$;`,
    `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type') THEN
        CREATE TYPE custom_field_type AS ENUM (
            'text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi_select',
            'user_picker', 'multi_user_picker', 'group_picker', 'project_picker',
            'version_picker', 'component_picker', 'label', 'url', 'checkbox', 'radio',
            'cascade_select', 'date_range', 'time', 'currency', 'percentage'
        );
    END IF;
END $$;`
];

async function run() {
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected!');
        
        // Run all in a single query (like the original migration)
        const combined = enumBlocks.join('\n');
        console.log('Running all enums in single query...');
        try {
            await client.query(combined);
            console.log('All enums OK');
        } catch (err) {
            console.error(`FAILED: ${err.code} - ${err.message}`);
        }
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();