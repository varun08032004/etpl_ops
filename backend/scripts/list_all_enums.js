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
        
        const res = await client.query("SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname");
        console.log('All enum types:', res.rows.map(r => r.typname));
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();