require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery('SELECT * FROM revenue_recognition_schedules');
  for (const s of rows) {
    console.log(s.id, s.invoice_id, s.total_amount, s.recognized_amount, s.is_complete, s.next_recognition_date);
  }
  process.exit(0);
})();