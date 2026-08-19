require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery(`SELECT * FROM prepaid_expense_schedules WHERE bill_id = $1`, ['e3b6b903-4669-4026-a543-873b91c0952e']);
  console.log('Prepaid schedule:', rows[0]);
  
  const start = new Date(rows[0].start_date);
  const end = new Date(rows[0].end_date);
  const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  console.log('Total months:', totalMonths);
  console.log('Monthly amount:', rows[0].total_amount / totalMonths);
  console.log('Next expense date:', rows[0].next_expense_date);
  
  process.exit(0);
})();