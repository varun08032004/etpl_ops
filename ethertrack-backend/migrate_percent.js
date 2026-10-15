const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const sql = `
BEGIN;

ALTER TABLE plan_prices ADD COLUMN IF NOT EXISTS buyer_fee_percent NUMERIC(10,5) NOT NULL DEFAULT 0;
ALTER TABLE plan_prices ADD COLUMN IF NOT EXISTS seller_fee_percent NUMERIC(10,5) NOT NULL DEFAULT 0;

UPDATE plan_prices SET 
  buyer_fee_percent = CASE plan
    WHEN 'free' THEN 2.00000
    WHEN 'starter' THEN 1.00000
    WHEN 'growth' THEN 0.75000
    WHEN 'corporate' THEN 0.50000
    ELSE 1.00000
  END,
  seller_fee_percent = CASE plan
    WHEN 'free' THEN 0.00000
    WHEN 'starter' THEN 1.00000
    WHEN 'growth' THEN 0.75000
    WHEN 'corporate' THEN 0.50000
    ELSE 1.00000
  END
WHERE buyer_fee_percent = 0 OR seller_fee_percent = 0;

COMMENT ON COLUMN plan_prices.buyer_fee_percent IS 'Platform fee from buyer in percent (1.00000 = 1%)';
COMMENT ON COLUMN plan_prices.seller_fee_percent IS 'Platform fee from seller in percent (1.00000 = 1%)';

COMMIT;
`;

const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new (require('pg').Pool)({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query(sql).then(r => { console.log('Migration applied successfully!'); pool.end(); }).catch(e => { console.error('Error:', e.message, e.stack); pool.end(); });