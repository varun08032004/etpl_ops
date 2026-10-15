-- Migration: Add platform fee percent columns to plan_pricing
-- Date: 2026-10-13

BEGIN;

-- Add platform fee percent columns to plan_pricing
ALTER TABLE plan_pricing 
  ADD COLUMN IF NOT EXISTS buyer_fee_percent  NUMERIC(10,5) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_fee_percent NUMERIC(10,5) NOT NULL DEFAULT 0;

-- Set default values based on tier
UPDATE plan_pricing SET 
  buyer_fee_percent  = CASE plan_name
    WHEN 'free' THEN 2.00000
    WHEN 'starter' THEN 1.00000
    WHEN 'growth' THEN 0.75000
    WHEN 'corporate' THEN 0.50000
    ELSE 1.00000
  END,
  seller_fee_percent = CASE plan_name
    WHEN 'free' THEN 0.00000
    WHEN 'starter' THEN 1.00000
    WHEN 'growth' THEN 0.75000
    WHEN 'corporate' THEN 0.50000
    ELSE 1.00000
  END
WHERE buyer_fee_percent = 0 OR seller_fee_percent = 0;

-- Add comments
COMMENT ON COLUMN plan_pricing.buyer_fee_percent  IS 'Platform fee from buyer in percent (1.00000 = 1%)';
COMMENT ON COLUMN plan_pricing.seller_fee_percent IS 'Platform fee from seller in percent (1.00000 = 1%)';

COMMIT;