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
        
        // First, let's check what's using permission_type
        const res = await client.query(`
            SELECT c.relname 
            FROM pg_class c 
            JOIN pg_attribute a ON a.attrelid = c.oid 
            JOIN pg_type t ON a.atttypid = t.oid 
            WHERE t.typname = 'permission_type'
        `);
        console.log('Tables using permission_type:', res.rows);
        
        // Check pg_enum for permission_type
        const res2 = await client.query(`
            SELECT e.enumlabel, e.enumsortorder
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'permission_type'
            ORDER BY e.enumsortorder
        `);
        console.log('Current permission_type labels:', res2.rows.map(r => r.enumlabel));
        
        // Check if we can just add missing enum values
        const res3 = await client.query("SELECT pg_typeof('browse_project'::permission_type)");
        console.log('Type check:', res3.rows);
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();