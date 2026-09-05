-- ═══════════════════════════════════════════════════════════════════════════
-- PLAN PRICING — Configurable plan prices (replaces hardcoded constants)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_pricing (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_key        VARCHAR(50) NOT NULL UNIQUE,     -- 'starter', 'growth', 'corporate'
  plan_name       VARCHAR(100) NOT NULL,
  billing_cycle   VARCHAR(20) NOT NULL,            -- 'monthly', 'annual'
  price_inr       NUMERIC(14,2) NOT NULL DEFAULT 0,
  seats_included  INTEGER NOT NULL DEFAULT 1,      -- base seats included
  price_per_seat  NUMERIC(14,2) NOT NULL DEFAULT 0, -- additional seat price (for corporate)
  is_active       BOOLEAN DEFAULT TRUE,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,                            -- NULL = indefinite
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  updated_by      UUID REFERENCES staff_accounts(id)
);

CREATE INDEX idx_plan_pricing_key_cycle ON plan_pricing(plan_key, billing_cycle, effective_from);

-- Seed with current hardcoded values
INSERT INTO plan_pricing (plan_key, plan_name, billing_cycle, price_inr, seats_included, price_per_seat) VALUES
  ('starter', 'Starter', 'monthly', 2999, 1, 0),
  ('starter', 'Starter', 'annual', 2999 * 12 * 0.85, 1, 0),  -- 15% annual discount
  ('growth', 'Growth', 'monthly', 9999, 1, 0),
  ('growth', 'Growth', 'annual', 9999 * 12 * 0.85, 1, 0),    -- 15% annual discount
  ('corporate', 'Corporate', 'monthly', 49999, 5, 49999),     -- base 5 seats, then per seat
  ('corporate', 'Corporate', 'annual', 49999 * 12 * 0.85, 5, 49999)
ON CONFLICT (plan_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER — auto update updated_at
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plan_pricing_updated_at
  BEFORE UPDATE ON plan_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();