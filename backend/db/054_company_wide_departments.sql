-- Migration 054: Company-wide Departments (Shared across all 3 products)
-- Departments belong to EtherTrack Technologies Pvt Ltd, not to individual products
-- Products are separate; departments work on multiple products

-- 1. Reset departments to company-wide (remove product_id, make them shared)
ALTER TABLE departments DROP COLUMN IF EXISTS product_id;

-- 2. Update/Insert company-wide departments
INSERT INTO departments (name, code, description, status) VALUES
  ('Engineering', 'ENG', 'Backend, Frontend, DevOps, QA - builds ALL products (EtherTrack, Landing, Internal Ops)', 'active'),
  ('Product', 'PRD', 'Product Management, Design - roadmap & UX for ALL products', 'active'),
  ('Marketing', 'MKT', 'Content/SEO, Growth Marketing, Social/Community - primarily Landing, supports EtherTrack', 'active'),
  ('Design', 'DES', 'Web Design, Brand Assets, Product Design - shared across all products', 'active'),
  ('Growth', 'GROWTH', 'Sales, Partnerships, Customer Success - primarily EtherTrack', 'active'),
  ('Carbon Operations', 'CARB', 'Carbon credit sourcing, verification, registry - EtherTrack only', 'active'),
  ('Finance & Accounting', 'FIN', 'Accounting, Payroll, Controller - company-wide', 'active'),
  ('People Operations', 'HR', 'Recruiting, HR Generalist - company-wide', 'active'),
  ('Legal & Compliance', 'LEG', 'Legal Counsel - contracts, IP, compliance - company-wide', 'active'),
  ('Internal Tools', 'ITOOLS', 'Full-stack Engineers - builds/maintains Internal Ops product', 'active')
ON CONFLICT (name) DO UPDATE SET 
  code = EXCLUDED.code, 
  description = EXCLUDED.description, 
  status = EXCLUDED.status;

-- Deactivate old Accounts department
UPDATE departments SET status = 'inactive' WHERE name = 'Accounts';

-- 3. Teams under company-wide departments
-- Clean old teams first
DELETE FROM teams WHERE department_id IN (SELECT id FROM departments WHERE status = 'inactive');

-- Engineering teams (shared across products)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Backend', d.id, NULL FROM departments d WHERE d.name = 'Engineering'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Frontend', d.id, NULL FROM departments d WHERE d.name = 'Engineering'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'DevOps', d.id, NULL FROM departments d WHERE d.name = 'Engineering'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'QA', d.id, NULL FROM departments d WHERE d.name = 'Engineering'
ON CONFLICT DO NOTHING;

-- Product teams (shared)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Product Management', d.id, NULL FROM departments d WHERE d.name = 'Product'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Product Design', d.id, NULL FROM departments d WHERE d.name = 'Product'
ON CONFLICT DO NOTHING;

-- Marketing teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Content & SEO', d.id, NULL FROM departments d WHERE d.name = 'Marketing'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Growth Marketing', d.id, NULL FROM departments d WHERE d.name = 'Marketing'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Social & Community', d.id, NULL FROM departments d WHERE d.name = 'Marketing'
ON CONFLICT DO NOTHING;

-- Design teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Web Design', d.id, NULL FROM departments d WHERE d.name = 'Design'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Brand Assets', d.id, NULL FROM departments d WHERE d.name = 'Design'
ON CONFLICT DO NOTHING;

-- Growth teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Enterprise Sales', d.id, NULL FROM departments d WHERE d.name = 'Growth'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Partnerships', d.id, NULL FROM departments d WHERE d.name = 'Growth'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Customer Success', d.id, NULL FROM departments d WHERE d.name = 'Growth'
ON CONFLICT DO NOTHING;

-- Carbon Operations teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Carbon Analysts', d.id, NULL FROM departments d WHERE d.name = 'Carbon Operations'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Registry & Verification', d.id, NULL FROM departments d WHERE d.name = 'Carbon Operations'
ON CONFLICT DO NOTHING;

-- Finance & Accounting teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Accounting', d.id, NULL FROM departments d WHERE d.name = 'Finance & Accounting'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Controller', d.id, NULL FROM departments d WHERE d.name = 'Finance & Accounting'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Payroll', d.id, NULL FROM departments d WHERE d.name = 'Finance & Accounting'
ON CONFLICT DO NOTHING;

-- People Operations teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Recruiting', d.id, NULL FROM departments d WHERE d.name = 'People Operations'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'HR Operations', d.id, NULL FROM departments d WHERE d.name = 'People Operations'
ON CONFLICT DO NOTHING;

-- Legal & Compliance teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Legal', d.id, NULL FROM departments d WHERE d.name = 'Legal & Compliance'
ON CONFLICT DO NOTHING;

-- Internal Tools teams
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Platform Engineering', d.id, NULL FROM departments d WHERE d.name = 'Internal Tools'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Integrations', d.id, NULL FROM departments d WHERE d.name = 'Internal Tools'
ON CONFLICT DO NOTHING;

-- 4. Product-Department mapping (many-to-many: which departments work on which products)
CREATE TABLE IF NOT EXISTS product_departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  focus_area      VARCHAR(200),  -- e.g. 'core platform', 'landing pages', 'internal tooling'
  is_primary      BOOLEAN DEFAULT FALSE,  -- primary department for this product
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_product_departments_product ON product_departments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_departments_dept ON product_departments(department_id);

-- Map departments to products
-- EtherTrack (core SaaS) - primary: Engineering, Product, Carbon Operations, Growth
INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'core platform', TRUE FROM products p, departments d 
WHERE p.slug = 'ethertrack' AND d.name IN ('Engineering', 'Product', 'Carbon Operations', 'Growth')
ON CONFLICT DO NOTHING;

INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'design & UX', FALSE FROM products p, departments d 
WHERE p.slug = 'ethertrack' AND d.name IN ('Design')
ON CONFLICT DO NOTHING;

INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'marketing support', FALSE FROM products p, departments d 
WHERE p.slug = 'ethertrack' AND d.name IN ('Marketing')
ON CONFLICT DO NOTHING;

INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'finance/legal/hr support', FALSE FROM products p, departments d 
WHERE p.slug = 'ethertrack' AND d.name IN ('Finance & Accounting', 'People Operations', 'Legal & Compliance')
ON CONFLICT DO NOTHING;

-- EtherTrack Landing (marketing) - primary: Marketing, Design
INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'landing pages, SEO, content', TRUE FROM products p, departments d 
WHERE p.slug = 'landing' AND d.name IN ('Marketing', 'Design')
ON CONFLICT DO NOTHING;

INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'engineering support', FALSE FROM products p, departments d 
WHERE p.slug = 'landing' AND d.name IN ('Engineering')
ON CONFLICT DO NOTHING;

-- Internal Ops (internal tool) - primary: Internal Tools, Engineering
INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'internal tooling', TRUE FROM products p, departments d 
WHERE p.slug = 'ops' AND d.name IN ('Internal Tools', 'Engineering')
ON CONFLICT DO NOTHING;

INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'product/design support', FALSE FROM products p, departments d 
WHERE p.slug = 'ops' AND d.name IN ('Product', 'Design')
ON CONFLICT DO NOTHING;

INSERT INTO product_departments (product_id, department_id, focus_area, is_primary)
SELECT p.id, d.id, 'finance/hr/legal support', FALSE FROM products p, departments d 
WHERE p.slug = 'ops' AND d.name IN ('Finance & Accounting', 'People Operations', 'Legal & Compliance')
ON CONFLICT DO NOTHING;

-- 5. Hiring plans per department (company-wide, not per product)
-- Clean old hiring plans
DELETE FROM product_hiring_plans;

-- Engineering hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Backend Engineer', d.id, 3, 0, 'high', '2026-12-31', 'Works on EtherTrack core + Internal Ops'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Engineering'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Frontend Engineer', d.id, 3, 0, 'high', '2026-12-31', 'Works on EtherTrack dashboard + Landing + Internal Ops'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Engineering'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'DevOps Engineer', d.id, 1, 0, 'medium', '2027-03-31', 'AWS, CI/CD for all products'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Engineering'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'QA Engineer', d.id, 1, 0, 'low', '2027-06-30', 'Testing across all products'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Engineering'
ON CONFLICT DO NOTHING;

-- Product hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Product Manager', d.id, 2, 0, 'critical', '2026-09-30', 'Owns roadmap for EtherTrack + Landing + Internal Ops'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Product'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Product Designer', d.id, 2, 0, 'high', '2026-10-31', 'UX for all 3 products'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Product'
ON CONFLICT DO NOTHING;

-- Marketing hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Content Marketing Lead', d.id, 1, 0, 'high', '2026-10-31', 'Blog, whitepapers, SEO for Landing + EtherTrack'
FROM products p, departments d WHERE p.slug = 'landing' AND d.name = 'Marketing'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Growth Marketer', d.id, 1, 0, 'high', '2026-11-30', 'Paid acquisition, conversion for Landing'
FROM products p, departments d WHERE p.slug = 'landing' AND d.name = 'Marketing'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'SEO Specialist', d.id, 1, 0, 'medium', '2027-01-31', 'Technical SEO for ethertrack.in'
FROM products p, departments d WHERE p.slug = 'landing' AND d.name = 'Marketing'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Social Media Manager', d.id, 1, 0, 'low', '2027-03-31', 'LinkedIn, Twitter, community'
FROM products p, departments d WHERE p.slug = 'landing' AND d.name = 'Marketing'
ON CONFLICT DO NOTHING;

-- Design hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Product Designer', d.id, 1, 0, 'high', '2026-10-31', 'Landing pages + product UI'
FROM products p, departments d WHERE p.slug = 'landing' AND d.name = 'Design'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Brand Designer', d.id, 1, 0, 'medium', '2027-01-31', 'Brand assets, visual identity'
FROM products p, departments d WHERE p.slug = 'landing' AND d.name = 'Design'
ON CONFLICT DO NOTHING;

-- Growth hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Enterprise Sales Lead', d.id, 1, 0, 'critical', '2026-09-30', 'Sell EtherTrack to corporates'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Growth'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'SDR/BDR', d.id, 2, 0, 'high', '2026-11-30', 'Outbound pipeline for EtherTrack'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Growth'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Partnerships Manager', d.id, 1, 0, 'medium', '2027-01-31', 'Registry partners, verifiers, marketplaces'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Growth'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Customer Success Manager', d.id, 1, 0, 'high', '2026-12-31', 'Onboarding + retention for EtherTrack'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Growth'
ON CONFLICT DO NOTHING;

-- Carbon Operations hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Carbon Analyst', d.id, 2, 0, 'critical', '2026-09-30', 'Project due diligence, registry mgmt'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Carbon Operations'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Carbon Operations Lead', d.id, 1, 0, 'high', '2026-10-31', 'Supplier relationships, verification pipeline'
FROM products p, departments d WHERE p.slug = 'ethertrack' AND d.name = 'Carbon Operations'
ON CONFLICT DO NOTHING;

-- Finance & Accounting hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Finance Controller', d.id, 1, 0, 'critical', '2026-09-30', 'Monthly close, GST, TDS, board reporting'
FROM products p, departments d WHERE p.slug = 'ops' AND d.name = 'Finance & Accounting'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Accountant', d.id, 1, 0, 'high', '2026-10-31', 'AP/AR, reconciliations, vendor mgmt'
FROM products p, departments d WHERE p.slug = 'ops' AND d.name = 'Finance & Accounting'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Payroll Specialist', d.id, 1, 0, 'medium', '2027-01-31', 'Razorpay payouts, PF/ESI, compliance'
FROM products p, departments d WHERE p.slug = 'ops' AND d.name = 'Finance & Accounting'
ON CONFLICT DO NOTHING;

-- People Operations hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Recruiter', d.id, 1, 0, 'high', '2026-09-30', 'Full-cycle hiring for all departments'
FROM products p, departments d WHERE p.slug = 'ops' AND d.name = 'People Operations'
ON CONFLICT DO NOTHING;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'HR Generalist', d.id, 1, 0, 'medium', '2027-01-31', 'Onboarding, policies, engagement, compliance'
FROM products p, departments d WHERE p.slug = 'ops' AND d.name = 'People Operations'
ON CONFLICT DO NOTHING;

-- Legal & Compliance hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Legal Counsel', d.id, 1, 0, 'high', '2026-12-31', 'Contracts, IP, data privacy, compliance'
FROM products p, departments d WHERE p.slug = 'ops' AND d.name = 'Legal & Compliance'
ON CONFLICT DO NOTHING;

-- Internal Tools hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Full Stack Engineer (Internal Tools)', d.id, 2, 0, 'high', '2026-11-30', 'Build/maintain ops.ethertrack.in, agent, integrations'
FROM products p, departments d WHERE p.slug = 'ops' AND d.name = 'Internal Tools'
ON CONFLICT DO NOTHING;

-- Refresh current counts from actual employees
SELECT refresh_product_hiring_counts();