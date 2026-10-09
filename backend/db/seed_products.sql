-- Seed: 3 Products for EtherTrack Operations
-- Run AFTER 052_products.sql
-- Uses existing departments (looks up by name) instead of hardcoded UUIDs

-- 1. EtherTrack Core Product (app.ethertrack.in)
INSERT INTO products (id, name, slug, domain, description, product_type, stage, monthly_revenue_inr, target_mrr_inr)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'EtherTrack',
  'ethertrack',
  'app.ethertrack.in',
  'Core carbon credit portfolio management & marketplace platform. Customers use this to manage, trade, and retire carbon credits.',
  'saas', 'live', 0, 5000000  -- targeting ₹50L MRR
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  description = EXCLUDED.description,
  product_type = EXCLUDED.product_type,
  stage = EXCLUDED.stage,
  target_mrr_inr = EXCLUDED.target_mrr_inr;

-- 2. EtherTrack Landing/Marketing (ethertrack.in)
INSERT INTO products (id, name, slug, domain, description, product_type, stage, monthly_revenue_inr, target_mrr_inr)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'EtherTrack Landing',
  'landing',
  'ethertrack.in',
  'Public marketing website, blog, SEO, lead capture. Drives traffic and signups for the core product.',
  'marketing', 'live', 0, 0  -- no direct revenue, supports core
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  description = EXCLUDED.description,
  product_type = EXCLUDED.product_type,
  stage = EXCLUDED.stage;

-- 3. Internal Ops Tool (ops.ethertrack.in)
INSERT INTO products (id, name, slug, domain, description, product_type, stage, monthly_revenue_inr, target_mrr_inr)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Internal Ops',
  'ops',
  'ops.ethertrack.in',
  'Internal HR, finance, payroll, accounting, team management tool. Runs the company.',
  'internal_tool', 'live', 0, 0  -- cost center, not revenue
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  description = EXCLUDED.description,
  product_type = EXCLUDED.product_type,
  stage = EXCLUDED.stage;

-- Link existing departments to products
-- EtherTrack Core: Product, Engineering (Operations), Sales, Carbon Operations (new)
UPDATE departments SET product_id = '11111111-1111-1111-1111-111111111111' WHERE name IN ('Product', 'Operations', 'Sales');
-- Create Carbon Operations department if not exists
INSERT INTO departments (name, code, description, product_id, status)
VALUES ('Carbon Operations', 'CARB', 'Carbon credit sourcing, verification, registry management', '11111111-1111-1111-1111-111111111111', 'active')
ON CONFLICT (name) DO UPDATE SET product_id = '11111111-1111-1111-1111-111111111111', description = EXCLUDED.description;

-- Landing/Marketing: Marketing, Design (new)
UPDATE departments SET product_id = '22222222-2222-2222-2222-222222222222' WHERE name = 'Marketing';
INSERT INTO departments (name, code, description, product_id, status)
VALUES ('Design', 'DES', 'Web design, landing pages, brand assets, UI/UX', '22222222-2222-2222-2222-222222222222', 'active')
ON CONFLICT (name) DO UPDATE SET product_id = '22222222-2222-2222-2222-222222222222', description = EXCLUDED.description;

-- Internal Ops: Finance, Human Resources, Legal & Compliance, Administration (Internal Tools)
UPDATE departments SET product_id = '33333333-3333-3333-3333-333333333333' WHERE name IN ('Finance', 'Human Resources', 'Legal & Compliance', 'Administration');
-- Accounts -> Finance product too (accounting work)
UPDATE departments SET product_id = '33333333-3333-3333-3333-333333333333' WHERE name = 'Accounts';

-- Now hiring plans per product using actual department IDs
-- ============================================================
-- ETHERTRACK CORE (11111111-1111-1111-1111-111111111111)
-- ============================================================

-- Product department hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Product Manager', d.id, 2, 0, 'critical', '2026-09-30', 'Own roadmap + marketplace + carbon ops features'
FROM departments d WHERE d.name = 'Product' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Product Designer', d.id, 1, 0, 'high', '2026-10-31', 'User research, UI/UX for complex carbon workflows'
FROM departments d WHERE d.name = 'Product' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

-- Engineering (Operations department) hiring
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Backend Engineer', d.id, 4, 0, 'high', '2026-12-31', 'Core platform + marketplace + APIs'
FROM departments d WHERE d.name = 'Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Frontend Engineer', d.id, 3, 0, 'high', '2026-12-31', 'React/Next.js for app + dashboard'
FROM departments d WHERE d.name = 'Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'DevOps/Platform Engineer', d.id, 1, 0, 'medium', '2027-03-31', 'AWS, CI/CD, monitoring'
FROM departments d WHERE d.name = 'Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'QA Engineer', d.id, 1, 0, 'low', '2027-06-30', 'Automated testing'
FROM departments d WHERE d.name = 'Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

-- Sales & Growth
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Enterprise Sales Lead', d.id, 1, 0, 'critical', '2026-09-30', 'Sell to corporates, project developers'
FROM departments d WHERE d.name = 'Sales' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'SDR/BDR', d.id, 2, 0, 'high', '2026-11-30', 'Outbound pipeline generation'
FROM departments d WHERE d.name = 'Sales' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Partnerships Manager', d.id, 1, 0, 'medium', '2027-01-31', 'Registry partners, verifiers, marketplaces'
FROM departments d WHERE d.name = 'Sales' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

-- Carbon Operations
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Carbon Analyst', d.id, 2, 0, 'critical', '2026-09-30', 'Project due diligence, registry mgmt, credit quality'
FROM departments d WHERE d.name = 'Carbon Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Carbon Operations Lead', d.id, 1, 0, 'high', '2026-10-31', 'Manage supplier relationships, verification pipeline'
FROM departments d WHERE d.name = 'Carbon Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

-- ============================================================
-- LANDING / MARKETING (22222222-2222-2222-2222-222222222222)
-- ============================================================

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Content Marketing Lead', d.id, 1, 0, 'high', '2026-10-31', 'Blog, whitepapers, case studies, SEO'
FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'SEO Specialist', d.id, 1, 0, 'medium', '2027-01-31', 'Technical SEO, keyword strategy'
FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Social Media Manager', d.id, 1, 0, 'low', '2027-03-31', 'LinkedIn, Twitter, community'
FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Product Designer (Marketing)', d.id, 1, 0, 'high', '2026-10-31', 'Landing pages, conversion optimization'
FROM departments d WHERE d.name = 'Design' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

-- ============================================================
-- INTERNAL OPS (33333333-3333-3333-3333-333333333333)
-- ============================================================

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Finance Controller', d.id, 1, 0, 'critical', '2026-09-30', 'Monthly close, GST, TDS, board reporting'
FROM departments d WHERE d.name = 'Finance' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Accountant', d.id, 1, 0, 'high', '2026-10-31', 'AP/AR, reconciliations, vendor mgmt'
FROM departments d WHERE d.name IN ('Finance', 'Accounts') AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Payroll Specialist', d.id, 1, 0, 'medium', '2027-01-31', 'Razorpay payouts, PF/ESI, compliance'
FROM departments d WHERE d.name = 'Finance' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Recruiter', d.id, 1, 0, 'high', '2026-09-30', 'Full-cycle hiring for all 3 products'
FROM departments d WHERE d.name = 'Human Resources' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'HR Generalist', d.id, 1, 0, 'medium', '2027-01-31', 'Onboarding, policies, engagement, compliance'
FROM departments d WHERE d.name = 'Human Resources' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Legal Counsel', d.id, 1, 0, 'high', '2026-12-31', 'Contracts, IP, data privacy, compliance'
FROM departments d WHERE d.name = 'Legal & Compliance' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Full Stack Engineer (Internal Tools)', d.id, 2, 0, 'high', '2026-11-30', 'Build/maintain ops tool, agent, integrations'
FROM departments d WHERE d.name = 'Administration' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (product_id, designation_id, department_id) DO UPDATE SET target_count = EXCLUDED.target_count, priority = EXCLUDED.priority, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes;

-- Refresh current counts
SELECT refresh_product_hiring_counts();