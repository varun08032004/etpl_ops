require('dotenv').config();
const { Pool } = require('pg');

async function runSeed() {
  const pool = new Pool({
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const ownerRes = await pool.query("SELECT id FROM staff_accounts WHERE role = 'owner' LIMIT 1");
    const ownerId = ownerRes.rows[0]?.id;
    
    if (!ownerId) {
      console.log('No owner account found, skipping automation rules seed');
      return;
    }

    // Check existing rules
    const existing = await pool.query(
      "SELECT name, trigger_event FROM automation_rules WHERE name IN ($1, $2)",
      ['Compliance Due Soon - Email Alert', 'Compliance Escalated - Email Alert']
    );
    const existingNames = new Set(existing.rows.map(r => r.name));

    // Rule 1: Compliance Due Soon
    if (!existingNames.has('Compliance Due Soon - Email Alert')) {
      await pool.query(
        `INSERT INTO automation_rules (name, trigger_event, action_type, config, is_active, created_by)
         VALUES ($1, $2, $3, $4, TRUE, $5)`,
        [
          'Compliance Due Soon - Email Alert',
          'compliance_item.due_soon',
          'send_email',
          JSON.stringify({
            to_template: 'admin@ethertrack.in',
            subject: '⚠ Compliance Due Soon: {{title}} ({{days_until_due}} days)',
            body_template: 'Compliance filing "{{title}}" ({{category}}) is due on {{due_date}}.\n\nDays until due: {{days_until_due}}\nOwner: {{owner_name}}\n\nPlease take action: {{link}}'
          }),
          ownerId
        ]
      );
      console.log('✅ Inserted: Compliance Due Soon - Email Alert');
    } else {
      console.log('⏭️ Already exists: Compliance Due Soon - Email Alert');
    }

    // Rule 2: Compliance Escalated
    if (!existingNames.has('Compliance Escalated - Email Alert')) {
      await pool.query(
        `INSERT INTO automation_rules (name, trigger_event, action_type, config, is_active, created_by)
         VALUES ($1, $2, $3, $4, TRUE, $5)`,
        [
          'Compliance Escalated - Email Alert',
          'compliance_item.escalated',
          'send_email',
          JSON.stringify({
            to_template: 'admin@ethertrack.in',
            subject: '🚨 COMPLIANCE ESCALATED: {{title}}',
            body_template: 'URGENT: Compliance filing "{{title}}" ({{category}}) was due on {{due_date}} and has not been filed.\n\nOwner: {{owner_name}}\nStatus: No action taken after final reminder.\n\nImmediate attention required: {{link}}'
          }),
          ownerId
        ]
      );
      console.log('✅ Inserted: Compliance Escalated - Email Alert');
    } else {
      console.log('⏭️ Already exists: Compliance Escalated - Email Alert');
    }

    console.log('✅ Automation rules seeded successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeed();