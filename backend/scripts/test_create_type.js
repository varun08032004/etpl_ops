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
        
        // Test DO block with single label
        console.log('Testing DO block with single label...');
        try {
            await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_type_1') THEN
        CREATE TYPE test_type_1 AS ENUM ('browse_project');
    END IF;
END $$;`);
            console.log('DO block with single label worked!');
        } catch (err) {
            console.error('DO block with single label failed:', err.code, err.message);
        }
        
        // Clean up
        await client.query("DROP TYPE IF EXISTS test_type_1");
        
        // Test DO block with multiple labels
        console.log('\nTesting DO block with multiple labels...');
        try {
            await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_type_2') THEN
        CREATE TYPE test_type_2 AS ENUM ('browse_project', 'create_issues');
    END IF;
END $$;`);
            console.log('DO block with multiple labels worked!');
        } catch (err) {
            console.error('DO block with multiple labels failed:', err.code, err.message);
        }
        
        await client.query("DROP TYPE IF EXISTS test_type_2");
        
        // Test the full permission_type DO block
        console.log('\nTesting full permission_type DO block...');
        try {
            await client.query(`DO $$ BEGIN
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
END $$;`);
            console.log('Full permission_type DO block worked!');
        } catch (err) {
            console.error('Full permission_type DO block failed:', err.code, err.message);
        }
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();