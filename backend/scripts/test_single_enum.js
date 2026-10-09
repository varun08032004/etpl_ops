const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
    max: 1,
});

async function test() {
    const client = await pool.connect();
    try {
        console.log('Testing issue_type creation...');
        const start = Date.now();
        await pool.query("CREATE TYPE issue_type AS ENUM ('epic', 'story', 'task', 'bug', 'subtask', 'incident', 'problem', 'change', 'service_request')");
        console.log('issue_type created in', Date.now() - start, 'ms');
    } catch (err) {
        if (err.code === '42710') {
            console.log('already exists');
        } else {
            console.error('Error:', err.code, err.message);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

test();