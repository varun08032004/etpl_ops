#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

async function fixTrigger() {
  console.log('Fixing trigger function to use bill_date instead of entry_date...');
  
  try {
    // Fix the enforce_closed_period function
    await safeQuery(`
      CREATE OR REPLACE FUNCTION enforce_closed_period()
      RETURNS TRIGGER AS $$
      DECLARE
        period_closed BOOLEAN;
      BEGIN
        SELECT is_closed INTO period_closed
        FROM fiscal_periods
        WHERE NEW.bill_date BETWEEN start_date AND end_date LIMIT 1;
        IF period_closed THEN
          RAISE EXCEPTION 'Cannot modify entries in a closed fiscal period. Period is closed.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Fixed enforce_closed_period function');
    
    // Also fix the journal_lines trigger function if it exists
    await safeQuery(`
      CREATE OR REPLACE FUNCTION enforce_closed_period_lines()
      RETURNS TRIGGER AS $$
      DECLARE
        period_closed BOOLEAN;
        je_date DATE;
      BEGIN
        SELECT entry_date INTO je_date FROM journal_entries WHERE id = NEW.journal_entry_id;
        SELECT is_closed INTO period_closed
        FROM fiscal_periods
        WHERE je_date BETWEEN start_date AND end_date LIMIT 1;
        IF period_closed THEN
          RAISE EXCEPTION 'Cannot modify journal lines in a closed fiscal period. Period is closed.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Fixed enforce_closed_period_lines function');
    
    // Now update the bill
    await safeQuery(
      `UPDATE bills SET is_prepaid = true, prepaid_end_date = $1 WHERE id = $2`,
      ['2029-05-31', 'e3b6b903-4669-4026-a543-873b91c0952e']
    );
    console.log('✅ Bill updated to prepaid');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
  
  process.exit(0);
}

fixTrigger().catch(e => { console.error(e); process.exit(1); });