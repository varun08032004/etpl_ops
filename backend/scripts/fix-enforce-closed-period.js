#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

async function fixEnforceClosedPeriod() {
  console.log('Fixing enforce_closed_period to handle multiple tables...');
  
  try {
    await safeQuery(`
      CREATE OR REPLACE FUNCTION enforce_closed_period()
      RETURNS TRIGGER AS $$
      DECLARE
        period_closed BOOLEAN;
        check_date DATE;
      BEGIN
        -- Use the appropriate date column based on the table
        CASE TG_TABLE_NAME
          WHEN 'bills' THEN check_date := NEW.bill_date;
          WHEN 'invoices' THEN check_date := NEW.invoice_date;
          WHEN 'payments_received' THEN check_date := NEW.payment_date;
          WHEN 'payments_made' THEN check_date := NEW.payment_date;
          WHEN 'payroll_runs' THEN check_date := NEW.period_start;
          WHEN 'journal_entries' THEN check_date := NEW.entry_date;
          ELSE check_date := CURRENT_DATE;
        END CASE;
        
        SELECT is_closed INTO period_closed
        FROM fiscal_periods
        WHERE check_date BETWEEN start_date AND end_date LIMIT 1;
        
        IF period_closed THEN
          RAISE EXCEPTION 'Cannot modify entries in a closed fiscal period. Period is closed.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Fixed enforce_closed_period function');
    
    // Test by inserting a journal entry
    const { rows: [admin] } = await safeQuery(
      `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
    );
    
    const { safeQuery: sq } = require('../db/pool');
    const { rows: [test] } = await sq(`
      INSERT INTO journal_entries (entry_date, source, source_type, narration, created_by)
      VALUES ('2026-08-16', 'test', 'test', 'Trigger test', $1)
      RETURNING id
    `, [admin.id]);
    
    console.log(`✅ Test journal entry created: ${test.id}`);
    
    // Clean up test entry
    await sq(`DELETE FROM journal_entries WHERE id = $1`, [test.id]);
    console.log('✅ Test entry cleaned up');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
  
  process.exit(0);
}

fixEnforceClosedPeriod().catch(e => { console.error(e); process.exit(1); });