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
        
        // Check pg_enum for permission-related labels
        const res = await client.query(`
            SELECT e.enumlabel, e.enumtypid, t.typname 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE e.enumlabel IN (
                'browse_project', 'create_issues', 'edit_issues', 'delete_issues',
                'blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicated_by'
            )
            ORDER BY t.typname, e.enumsortorder
        `);
        console.log('Matching enum labels:', res.rows);
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();