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

        // Create missing enum types
        const enums = [
            { 
                name: 'permission_type', 
                values: "('browse_project', 'create_issues', 'edit_issues', 'delete_issues', 'assign_issues', 'resolve_issues', 'close_issues', 'reopen_issues', 'transition_issues', 'schedule_issues', 'move_issues', 'link_issues', 'set_issue_security', 'manage_watchers', 'add_comments', 'edit_own_comments', 'edit_all_comments', 'delete_own_comments', 'delete_all_comments', 'create_attachments', 'delete_own_attachments', 'delete_all_attachments', 'work_on_issues', 'view_voters_watchers', 'manage_issue_links', 'bulk_change', 'manage_sprints', 'view_dev_tools', 'manage_versions', 'manage_components', 'manage_versions', 'manage_reports', 'administer_projects')" 
            },
            { 
                name: 'jira_link_type', 
                values: "('blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicated_by', 'clones', 'cloned_from', 'parent_of', 'child_of', 'relates_to')" 
            },
        ];

        for (const e of enums) {
            try {
                console.log('Creating', e.name + '...');
                await client.query(`CREATE TYPE ${e.name} AS ENUM ${e.values}`);
                console.log(e.name, 'created successfully');
            } catch (err) {
                if (err.code === '42710') {
                    console.log(e.name, 'already exists, skipping');
                } else {
                    console.error('Error creating', e.name, ':', err.code, err.message);
                }
            }
        }
        
        console.log('All enum types processed');
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();