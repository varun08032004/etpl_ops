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
        
        const permissionLabels = ['browse_project', 'create_issues', 'edit_issues', 'delete_issues'];
        
        for (const label of permissionLabels) {
            const res = await client.query("SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE e.enumlabel = $1", [label]);
            console.log(`Label "${label}":`, res.rows.map(r => r.typname));
        }
        
        // Also check if there's a transaction issue - try creating the type directly without DO block
        console.log('\nTrying direct CREATE TYPE...');
        try {
            await client.query("CREATE TYPE permission_type AS ENUM ('browse_project')");
            console.log('Direct CREATE TYPE worked!');
        } catch (err) {
            console.error('Direct CREATE TYPE failed:', err.code, err.message);
        }
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();