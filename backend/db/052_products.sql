-- Migration 052: Products — business products as operational units with hiring plans
-- Run AFTER schema.sql and 009_missing_tables.sql (needs departments table)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products: each product is a distinct business line (EtherTrack, Landing, Internal Ops)
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(150) NOT NULL UNIQUE,
  slug                VARCHAR(50) NOT NULL UNIQUE,           -- URL-friendly: ethertrack, landing, ops
  domain              VARCHAR(100),                          -- e.g. app.ethertrack.in
  description         TEXT,
  product_type        VARCHAR(30) NOT NULL DEFAULT 'saas' CHECK (product_type IN ('saas', 'marketing', 'internal_tool', 'other')),
  stage               VARCHAR(30) NOT NULL DEFAULT 'live' CHECK (stage IN ('idea', 'building', 'beta', 'live', 'maintenance', 'sunset')),
  owner_employee_id   UUID REFERENCES employees(id),         -- product owner (single accountable person)
  is_active           BOOLEAN DEFAULT TRUE,
  monthly_revenue_inr NUMERIC(14,2) DEFAULT 0,               -- current MRR for this product
  target_mrr_inr      NUMERIC(14,2) DEFAULT 0,               -- target MRR
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stage ON products(stage);

-- Link departments to products (a department belongs to ONE product)
ALTER TABLE departments ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_departments_product ON departments(product_id);

-- Hiring plan per product: target headcount by designation/role
CREATE TABLE IF NOT EXISTS product_hiring_plans (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  designation_id        UUID REFERENCES designations(id),    -- specific role (can be NULL for generic)
  role_title            VARCHAR(150) NOT NULL,               -- e.g. "Backend Engineer", "Sales Lead"
  department_id         UUID REFERENCES departments(id),     -- which department this role sits in
  target_count          INTEGER NOT NULL DEFAULT 0,          -- how many people we want
  current_count         INTEGER NOT NULL DEFAULT 0,          -- auto-computed from employees
  priority              VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  target_date           DATE,                                -- when we want to hit this
  notes                 TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, designation_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_hiring_plans_product ON product_hiring_plans(product_id);
CREATE INDEX IF NOT EXISTS idx_hiring_plans_priority ON product_hiring_plans(priority);

-- View: product team summary (current vs target)
CREATE OR REPLACE VIEW product_team_summary AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.slug,
  p.domain,
  p.stage,
  p.monthly_revenue_inr,
  p.target_mrr_inr,
  COALESCE(SUM(hp.target_count), 0) AS total_target_headcount,
  COALESCE(SUM(hp.current_count), 0) AS total_current_headcount,
  COALESCE(SUM(hp.target_count - hp.current_count), 0) AS total_gap,
  COUNT(DISTINCT d.id) AS department_count
FROM products p
LEFT JOIN product_hiring_plans hp ON hp.product_id = p.id
LEFT JOIN departments d ON d.product_id = p.id
WHERE p.is_active = TRUE
GROUP BY p.id, p.name, p.slug, p.domain, p.stage, p.monthly_revenue_inr, p.target_mrr_inr;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_hiring_plans_updated_at ON product_hiring_plans;
CREATE TRIGGER trg_hiring_plans_updated_at BEFORE UPDATE ON product_hiring_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to refresh current_count in hiring plans from actual employees
CREATE OR REPLACE FUNCTION refresh_product_hiring_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE product_hiring_plans hp
  SET current_count = (
    SELECT COUNT(*)
    FROM employees e
    WHERE e.department_id = hp.department_id
      AND e.status = 'active'
      AND (hp.designation_id IS NULL OR e.designation_id = hp.designation_id)
  )
  WHERE hp.department_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;