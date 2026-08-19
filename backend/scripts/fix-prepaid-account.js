require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Update prepaid expense schedule to use 5300 (Software & SaaS Tools)
  const { rows: [acct5300] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '5300'`);
  console.log('5300 account:', acct5300);
  
  await safeQuery(`UPDATE prepaid_expense_schedules SET expense_account_id = $1 WHERE bill_id = $2`,
    [acct5300.id, 'e3b6b903-4669-4026-a543-873b91c0952e']);
  console.log('✅ Updated prepaid expense schedule to 5300');
  
  // Also update the bill's expense_account_id for consistency
  await safeQuery(`UPDATE bills SET expense_account_id = $1 WHERE id = $2`,
    [acct5300.id, 'e3b6b903-4669-4026-a543-873b91c0952e']);
  console.log('✅ Updated bill expense_account_id to 5300');
  
  process.exit(0);
})();