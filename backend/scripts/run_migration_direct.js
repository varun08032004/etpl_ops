const { Pool } = require('pg');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ 
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL + '?sslmode=require&selibpqcompat=true',
    max: 1,
    connectionTimeoutMillis: 60000,
    idleTimeoutMillis: 10000,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Connecting...');
        const start = Date.now();
        const res = await pool.query('SELECT version()');
        console.log('Connected in', Date.now() - start, 'ms');
        console.log('Version:', res.rows[0].version.substring(0, 50));
        
        // Run the migration
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(__dirname, '..', 'db', '060_jira_comprehensive.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('\nRunning migration...');
        await pool.query(sql);
        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await pool.end();
    }
}

run();