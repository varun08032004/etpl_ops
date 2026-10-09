const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
});

async function run() {
    try {
        await client.connect();
        console.log('Connected!');
        
        // Drop permission_type if it exists but has no labels
        console.log('Dropping permission_type if exists...');
        await client.query('DROP TYPE IF EXISTS permission_type CASCADE');
        console.log('Dropped permission_type');
        
        // Create permission_type with correct labels
        console.log('Creating permission_type...');
        await client.query(`
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
            )
        `);
        console.log('permission_type created successfully');
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();