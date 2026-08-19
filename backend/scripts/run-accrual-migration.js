#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

async function runMigration() {
  console.log('Running accrual migration...');
  
  try {
    // 1. Add accounts
    await safeQuery(`
      INSERT INTO chart_of_accounts (code, name, account_type, is_group) VALUES
      ('2700', 'Deferred Revenue', 'liability', false),
      ('1500', 'Prepaid Expenses', 'asset', false)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('✅ Accounts added');

    // 2. Create tables
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS revenue_recognition_schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id UUID NOT NULL,
        total_amount NUMERIC(14,2) NOT NULL,
        recognized_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
        next_recognition_date DATE NOT NULL,
        is_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ revenue_recognition_schedules created');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS prepaid_expense_schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        bill_id UUID NOT NULL,
        total_amount NUMERIC(14,2) NOT NULL,
        expensed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        expense_account_id UUID NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
        next_expense_date DATE NOT NULL,
        is_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ prepaid_expense_schedules created');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS accrual_job_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        job_type VARCHAR(30) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        schedules_processed INTEGER DEFAULT 0,
        total_amount NUMERIC(14,2) DEFAULT 0,
        journal_entry_ids UUID[],
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        error_message TEXT,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ accrual_job_log created');

    // 3. Add columns to invoices and bills
    await safeQuery(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) DEFAULT 'one_time'`);
    console.log('✅ invoice_type column added');

    await safeQuery(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_prepaid BOOLEAN DEFAULT FALSE`);
    await safeQuery(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS prepaid_end_date DATE`);
    console.log('✅ bill prepaid columns added');

    // 4. Enable RLS
    await safeQuery(`ALTER TABLE revenue_recognition_schedules ENABLE ROW LEVEL SECURITY`);
    await safeQuery(`ALTER TABLE prepaid_expense_schedules ENABLE ROW LEVEL SECURITY`);
    await safeQuery(`ALTER TABLE accrual_job_log ENABLE ROW LEVEL SECURITY`);
    
    await safeQuery(`CREATE POLICY revenue_sched_all ON revenue_recognition_schedules FOR ALL USING (true)`);
    await safeQuery(`CREATE POLICY prepaid_sched_all ON prepaid_expense_schedules FOR ALL USING (true)`);
    await safeQuery(`CREATE POLICY accrual_log_all ON accrual_job_log FOR ALL USING (true)`);
    console.log('✅ RLS policies created');

    console.log('\n🎉 Migration completed successfully!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    throw e;
  }
}

runMigration().then(() => process.exit(0)).catch(() => process.exit(1));