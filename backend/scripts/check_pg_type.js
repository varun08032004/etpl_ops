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
        await client.connect();
        
        // Check pg_type for permission_type
        const res1 = await client.query("SELECT * FROM pg_type WHERE typname = 'permission_type'");
        console.log('permission_type in pg_type:', res1.rows);
        
        // Check if any enum has labels matching permission_type labels
        const permissionLabels = ['browse_project', 'create_issues', 'edit_issues', 'delete_issues', 'assign_issues', 'resolve_issues', 'close_issues', 'reopen_issues', 'transition_issues', 'schedule_issues', 'move_issues', 'link_issues', 'set_issue_security', 'manage_watchers', 'add_comments', 'edit_own_comments', 'edit_all_comments', 'delete_own_comments', 'delete_all_comments', 'create_attachments', 'delete_own_attachments', 'delete_all_attachments', 'work_on_issues', 'view_voters_watchers', 'manage_issue_links', 'bulk_change', 'manage_sprints', 'view_dev_tools', 'manage_versions', 'manage_components', 'manage_reports', 'administer_projects'];
        
        for (const label of permissionLabels) {
            const res = await client.query("SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE e.enumlabel = $1", [label]);
            if (res.rows.length > 0) {
                console.log(`Label "${label}" already exists in types:`, res.rows.map(r => r.typname));
            }
        }
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();