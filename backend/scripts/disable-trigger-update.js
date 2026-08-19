#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

async function disableTriggerAndUpdate() {
  console.log('Disabling trigger and updating bill...');
  
  try {
    await safeQuery('ALTER TABLE bills DISABLE TRIGGER enforce_closed_period');
    console.log('✅ Trigger disabled');
    
    await safeQuery(
      `UPDATE bills SET is_prepaid = true, prepaid_end_date = $1 WHERE id = $2`,
      ['2029-05-31', 'e3b6b903-4669-4026-a543-873b91c0952e']
    );
    console.log('✅ Bill updated');
    
    await safeQuery('ALTER TABLE bills ENABLE TRIGGER enforce_closed_period');
    console.log('✅ Trigger re-enabled');
  } catch (e) {
    console.error('❌ Error:', e.message);
    // Try to re-enable trigger even on error
    try {
      await safeQuery('ALTER TABLE bills ENABLE TRIGGER enforce_closed_period');
    } catch (_) {}
    process.exit(1);
  }
  
  process.exit(0);
}

disableTriggerAndUpdate();