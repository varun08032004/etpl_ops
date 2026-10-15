const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new (require('pg').Pool)({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
BEGIN;

-- Insert/Update Free tier
INSERT INTO plan_pricing (plan_key, plan_name, billing_cycle, price_inr, seats_included, buyer_fee_percent, seller_fee_percent, is_active, effective_from)
VALUES ('free', 'Free', 'monthly', 0, 1, 2.00000, 0.00000, true, CURRENT_DATE)
ON CONFLICT (plan_key, billing_cycle) DO UPDATE SET
  price_inr = EXCLUDED.price_inr,
  buyer_fee_percent = EXCLUDED.buyer_fee_percent,
  seller_fee_percent = EXCLUDED.seller_fee_percent,
  updated_at = NOW();

-- Update Starter tier
UPDATE plan_pricing SET 
  price_inr = 1199900,
  buyer_fee_percent = 1.00000,
  seller_fee_percent = 1.00000,
  seats_included = 3,
  updated_at = NOW()
WHERE plan_key = 'starter' AND billing_cycle = 'monthly';

-- Update Growth tier (annual pricing)
UPDATE plan_pricing SET 
  price_inr = 15600000,
  billing_cycle = 'annual',
  buyer_fee_percent = 0.75000,
  seller_fee_percent = 0.75000,
  seats_included = 10,
  updated_at = NOW()
WHERE plan_key = 'growth' AND billing_cycle = 'monthly';

-- Update Corporate tier
UPDATE plan_pricing SET 
  price_inr = 30000000,
  buyer_fee_percent = 0.50000,
  seller_fee_percent = 0.50000,
  seats_included = 50,
  updated_at = NOW()
WHERE plan_key = 'corporate' AND billing_cycle = 'monthly';

-- Insert Free tier if not exists
INSERT INTO plan_pricing (plan_key, plan_name, billing_cycle, price_inr, seats_included, buyer_fee_percent, seller_fee_percent, is_active, effective_from)
VALUES ('free', 'Free', 'monthly', 0, 1, 2.00000, 0.00000, true, CURRENT_DATE)
ON CONFLICT (plan_key, billing_cycle) DO UPDATE SET
  price_inr = EXCLUDED.price_inr,
  buyer_fee_percent = EXCLUDED.buyer_fee_percent,
  seller_fee_percent = EXCLUDED.seller_fee_percent,
  updated_at = NOW();

COMMIT;
`;

const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = require('./db/pool').pool;

const pool = new (require('pg').Pool)({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
BEGIN;

-- Insert/Update Free tier
INSERT INTO plan_pricing (plan_key, plan_name, billing_cycle, price_inr, seats_included, buyer_fee_percent, seller_fee_percent, is_active, effective_from)
VALUES ('free', 'Free', 'monthly', 0, 1, 2.00000, 0.00000, true, CURRENT_DATE)
ON CONFLICT (plan_key, billing_cycle) DO UPDATE SET
  price_inr = EXCLUDED.price_inr,
  buyer_fee_percent = EXCLUDED.buyer_fee_percent,
  seller_fee_percent = EXCLUDED.seller_fee_percent,
  updated_at = NOW();

-- Update Starter tier
UPDATE plan_pricing SET 
  price_inr = 1199900,
  buyer_fee_percent = 1.00000,
  seller_fee_percent = 1.00000,
  seats_included = 3,
  updated_at = NOW()
WHERE plan_key = 'starter' AND billing_cycle = 'monthly';

-- Update Growth tier (annual pricing)
UPDATE plan_pricing SET 
  price_inr = 15600000,
  billing_cycle = 'annual',
  buyer_fee_percent = 0.75000,
  seller_fee_percent = 0.75000,
  seats_included = 10,
  updated_at = NOW()
WHERE plan_key = 'growth' AND billing_cycle = 'monthly';

-- Update Corporate tier
UPDATE plan_pricing SET 
  price_inr = 30000000,
  buyer_fee_percent = 0.50000,
  seller_fee_percent = 0.50000,
  seats_included = 50,
  updated_at = NOW()
WHERE plan_key = 'corporate' AND billing_cycle = 'monthly';

-- Insert Free tier if not exists
INSERT INTO plan_pricing (plan_key, plan_name, billing_cycle, price_inr, seats_included, buyer_fee_percent, seller_fee_percent, is_active, effective_from)
VALUES ('free', 'Free', 'monthly', 0, 1, 2.00000, 0.00000, true, CURRENT_DATE)
ON CONFLICT (plan_key, billing_cycle) DO UPDATE SET
  price_inr = EXCLUDED.price_inr,
  buyer_fee_percent = EXCLUDED.buyer_fee_percent,
  seller_fee_percent = EXCLUDED.seller_fee_percent,
  updated_at = NOW();

COMMIT;
`;

const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new (require('pg').Pool)({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query(sql).then(r => { console.log('Migration applied successfully!'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); });