require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery('SELECT * FROM prepaid_expense_schedules WHERE bill_id = $1', ['e3b6b903-4669-4026-a543-873b91c0952e']);
  console.log('Prepaid schedule:', rows[0]);
  const { rows: [acct] } = await safeQuery('SELECT id, code, name FROM chart_of_accounts WHERE id = $1', [rows[0]?.expense_account_id]);
  console.log('Expense account:', acct);
  process.exit(0);
})();