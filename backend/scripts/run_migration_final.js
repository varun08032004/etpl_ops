const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
});

async function run() {
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected!');
        
        // Read and run the migration
        const migrationPath = path.join(__dirname, '..', 'db', '060_jira_comprehensive.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('\nRunning migration...');
        await client.query(sql);
        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
});

async function run() {
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected!');
        
        // Read and run the migration
        const migrationPath = path.join(__dirname, '..', 'db', '060_jira_comprehensive.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('\nRunning migration...');
        await client.query(sql);
        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();