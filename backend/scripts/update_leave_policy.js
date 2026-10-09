const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
});

async function calculateMonthsWorked(joiningDate) {
  const join = new Date(joiningDate);
  const now = new Date();
  let months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  if (now.getDate() < join.getDate()) months--;
  return Math.max(0, months);
}

client.connect().then(async () => {
  // Update company settings to match the policy
  await client.query(`
    UPDATE company_settings SET value = '2' WHERE key = 'monthly_paid_leaves';
    UPDATE company_settings SET value = '24' WHERE key = 'annual_leaves_per_year';
    UPDATE company_settings SET value = '0' WHERE key = 'sick_leaves_per_year';
    UPDATE company_settings SET value = '0' WHERE key = 'casual_leaves_per_year';
    UPDATE company_settings SET value = '3' WHERE key = 'max_leave_balance_cap';
  `);
  console.log('Updated company settings');
  
  // Update leave types - single unified leave type
  await client.query(`
    DELETE FROM leave_types WHERE name NOT IN ('Annual Leave', 'Sick Leave');
    UPDATE leave_types SET name = 'Paid Leave (Unified)', days_per_year = 24, is_paid = true WHERE name = 'Annual Leave';
    UPDATE leave_types SET name = 'Sick Leave (Legacy)', days_per_year = 0, is_paid = true WHERE name = 'Sick Leave';
    INSERT INTO leave_types (name, days_per_year, is_paid) VALUES 
    ('Emergency/Sick Leave', 0, true),
    ('Maternity Leave', 180, true),
    ('Paternity Leave', 15, true),
    ('Unpaid Leave', 0, false)
    ON CONFLICT (name) DO NOTHING;
  `);
  console.log('Updated leave types');
  
  // Update leave policies
  await client.query(`
    UPDATE leave_policies SET 
      accrual_per_month = 2,
      max_accrual = 3,
      carry_forward_limit = 3,
      requires_approval = true,
      approval_levels = '[{"role": "manager", "level": 1}]'
    WHERE leave_type_id = (SELECT id FROM leave_types WHERE name = 'Paid Leave (Unified)');
  `);
  console.log('Updated leave policies');
  
  // Update employee balances based on months worked, capped at 3
  const { rows: employees } = await client.query('SELECT id, full_name, date_of_joining, leave_balance_annual, leave_balance_sick FROM employees WHERE status = \'active\'');
  
  for (const emp of employees) {
    const months = await calculateMonthsWorked(emp.date_of_joining);
    const accrued = months * 2; // 2 days per month
    const cappedBalance = Math.min(accrued, 3); // Cap at 3
    
    if (cappedBalance !== Number(emp.leave_balance_annual)) {
      await client.query(
        'UPDATE employees SET leave_balance_annual = $1, leave_balance_sick = 0 WHERE id = $2',
        [cappedBalance, emp.id]
      );
      console.log(`Updated ${emp.full_name}: ${months} months -> Balance: ${cappedBalance} (capped at 3)`);
    } else {
      console.log(`${emp.full_name}: already at ${emp.leave_balance_annual}`);
    }
  }
  
  await client.end();
});

async function calculateMonthsWorked(joiningDate) {
  const join = new Date(joiningDate);
  const now = new Date();
  let months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  if (now.getDate() < join.getDate()) months--;
  return Math.max(0, months);
}