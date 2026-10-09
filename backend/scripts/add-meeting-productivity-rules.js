const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

// Meeting/call apps - auto-classified as productive
const MEETING_PRODUCTIVITY_RULES = [
  // Meeting apps
  { match_type: 'app', pattern: 'zoom.exe', category: 'productive', name: 'Zoom' },
  { match_type: 'app', pattern: 'teams.exe', category: 'productive', name: 'Microsoft Teams' },
  { match_type: 'app', pattern: 'ms-teams.exe', category: 'productive', name: 'Microsoft Teams (new)' },
  { match_type: 'app', pattern: 'webex.exe', category: 'productive', name: 'Cisco Webex' },
  { match_type: 'app', pattern: 'gotomeeting.exe', category: 'productive', name: 'GoToMeeting' },
  { match_type: 'app', pattern: 'bluejeans.exe', category: 'productive', name: 'BlueJeans' },
  { match_type: 'app', pattern: 'skype.exe', category: 'productive', name: 'Skype' },
  { match_type: 'app', pattern: 'slack.exe', category: 'productive', name: 'Slack' },
  { match_type: 'app', pattern: 'discord.exe', category: 'productive', name: 'Discord' },
  { match_type: 'app', pattern: 'zoom.us.exe', category: 'productive', name: 'Zoom (alt)' },
  
  // Communication domains
  { match_type: 'domain', pattern: 'zoom.us', category: 'productive', name: 'Zoom Web' },
  { match_type: 'domain', pattern: 'teams.microsoft.com', category: 'productive', name: 'Teams Web' },
  { match_type: 'domain', pattern: 'meet.google.com', category: 'productive', name: 'Google Meet' },
  { match_type: 'domain', pattern: 'webex.com', category: 'productive', name: 'Webex Web' },
  { match_type: 'domain', pattern: 'gotomeeting.com', category: 'productive', name: 'GoToMeeting Web' },
  { match_type: 'domain', pattern: 'slack.com', category: 'productive', name: 'Slack Web' },
  { match_type: 'domain', pattern: 'discord.com', category: 'productive', name: 'Discord Web' },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const rule of MEETING_PRODUCTIVITY_RULES) {
      await client.query(
        `INSERT INTO productivity_rules (match_type, pattern, category, name, is_active) 
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (match_type, pattern) DO UPDATE SET 
           category = EXCLUDED.category, 
           name = EXCLUDED.name,
           is_active = true`,
        [rule.match_type, rule.pattern, rule.category, rule.name]
      );
    }
    
    await client.query('COMMIT');
    console.log(`✅ Added/updated ${MEETING_PRODUCTIVITY_RULES.length} meeting app productivity rules`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();