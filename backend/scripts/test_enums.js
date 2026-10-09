const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
    max: 1,
});

async function test() {
    const client = await pool.connect();
    try {
        // Test creating project_type enum
        console.log('Testing project_type creation...');
        try {
            await client.query("CREATE TYPE project_type AS ENUM ('software', 'business', 'service_desk')");
            console.log('project_type created successfully');
        } catch (err) {
            if (err.code === '42710') {
                console.log('project_type already exists');
            } else {
                throw err;
            }
        }
        
        // Check if type exists
        const res = await client.query("SELECT typname FROM pg_type WHERE typname = 'project_type'");
        console.log('project_type exists:', res.rows.length > 0);
        
        // Check other enums
        const enumNames = ['issue_type', 'issue_priority', 'issue_status_category', 'sprint_status', 'workflow_transition_type', 'permission_type', 'jira_link_type', 'board_type', 'custom_field_type'];
        for (const name of enumNames) {
            const res = await client.query("SELECT typname FROM pg_type WHERE typname = $1", [name]);
            console.log(`${name} exists:`, res.rows.length > 0);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

test();