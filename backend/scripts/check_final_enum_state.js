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
        
        // Check for permission_type
        const res1 = await client.query("SELECT typname FROM pg_type WHERE typname = 'permission_type'");
        console.log('permission_type in pg_type:', res1.rows.length > 0 ? 'YES' : 'NO');
        
        // Check pg_enum for permission_type labels
        const res2 = await client.query(`
            SELECT e.enumlabel, e.enumtypid, t.typname 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'permission_type'
            ORDER BY e.enumsortorder
        `);
        console.log('permission_type enum labels:', res2.rows.map(r => r.enumlabel));
        
        // Check for jira_link_type
        const res3 = await client.query("SELECT typname FROM pg_type WHERE typname = 'jira_link_type'");
        console.log('jira_link_type in pg_type:', res3.rows.length > 0 ? 'YES' : 'NO');
        
        // Check pg_enum for jira_link_type
        const res4 = await client.query(`
            SELECT e.enumlabel, e.enumtypid, t.typname 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'jira_link_type'
            ORDER BY e.enumsortorder
        `);
        console.log('jira_link_type enum labels:', res4.rows);
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();