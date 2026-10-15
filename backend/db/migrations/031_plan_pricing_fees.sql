-- Migration: Add buyer_fee_percent and seller_fee_percent columns to plan_pricing
-- Date: 2026-10-13

BEGIN;

ALTER TABLE plan_pricing ADD COLUMN IF NOT EXISTS buyer_fee_percent NUMERIC(10,5) NOT NULL DEFAULT 0;
ALTER TABLE plan_pricing ADD COLUMN IF NOT EXISTS seller_fee_percent NUMERIC(10,5) NOT NULL DEFAULT 0;

UPDATE plan_pricing SET 
  buyer_fee_percent = CASE plan_name
    WHEN 'free' THEN 2.0 WHEN 'starter' THEN 1.0 WHEN 'growth' THEN 0.75 WHEN 'corporate' THEN 0.5 ELSE 1.0 END,
  seller_fee_percent = CASE plan_name
    WHEN 'free' THEN 0.0 WHEN 'starter' THEN 1.0 WHEN 'growth' THEN 0.75 WHEN 'corporate' THEN 0.5 ELSE 1.0 END
WHERE buyer_fee_percent = 0 OR seller_fee_percent = 0;

COMMENT ON COLUMN plan_pricing.buyer_fee_percent IS 'Platform fee from buyer in percent (1.00000 = 1%)';
COMMENT ON COLUMN plan_pricing.seller_fee_percent IS 'Platform fee from seller in percent (1.00000 = 1%)';

COMMIT;