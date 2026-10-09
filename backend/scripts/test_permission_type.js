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

async function run() {
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected!');
        
        // Test the permission_type creation
        const sql = `DO $$ BEGIN
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
END $$;`;
        
        console.log('Running permission_type creation...');
        await client.query(sql);
        console.log('Success!');
        
        // Check if it was created
        const res = await client.query("SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'permission_type' ORDER BY e.enumsortorder");
        console.log('permission_type labels:', res.rows);
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();