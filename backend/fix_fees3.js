const db = require('./db/pool');

const sql = `
UPDATE plan_pricing SET 
  buyer_fee_percent = CASE plan_name
    WHEN 'free' THEN 2.00000 WHEN 'starter' THEN 1.00000 WHEN 'growth' THEN 0.75000 WHEN 'corporate' THEN 0.50000 ELSE 1.00000 END,
  seller_fee_percent = CASE plan_name
    WHEN 'free' THEN 0.00000 WHEN 'starter' THEN 1.00000 WHEN 'growth' THEN 0.75000 WHEN 'corporate' THEN 0.50000 ELSE 1.00000 END
WHERE buyer_fee_percent = 0 OR seller_fee_percent = 0;
`;

const pool = require('./db/pool').pool;

pool.query(sql).then(r => { console.log('Updated rows:', r.rowCount); process.exit(0); }).catch(e => { console.error('Error:', e.message); process.exit(1); });