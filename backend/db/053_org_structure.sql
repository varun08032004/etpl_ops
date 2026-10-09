-- Migration 053: Ideal Org Structure for 3 Products (Fixed)
-- Run AFTER 052_products.sql and seed_products.sql
-- Updates existing departments + adds new ones

-- 1. Update products table with correct types
UPDATE products SET 
  product_type = 'saas',
  stage = 'live',
  description = 'Core carbon credit portfolio management & marketplace platform'
WHERE slug = 'ethertrack';

UPDATE products SET 
  product_type = 'marketing',
  stage = 'live',
  description = 'Public marketing website, blog, SEO, lead capture for EtherTrack'
WHERE slug = 'landing';

UPDATE products SET 
  product_type = 'internal_tool',
  stage = 'live',
  description = 'Internal HR, finance, payroll, accounting, team management tool'
WHERE slug = 'ops';

-- 2. Update existing departments to new structure
-- EtherTrack Core departments
UPDATE departments SET 
  name = 'Engineering', code = 'ENG', description = 'Backend, Frontend, DevOps, QA - builds and runs the platform', product_id = '11111111-1111-1111-1111-111111111111', status = 'active'
WHERE name = 'Operations';

UPDATE departments SET 
  name = 'Product', code = 'PRD', description = 'Product Management, Design - decides what to build and user experience', product_id = '11111111-1111-1111-1111-111111111111', status = 'active'
WHERE name = 'Product';

UPDATE departments SET 
  name = 'Carbon Operations', code = 'CARB', description = 'Carbon credit sourcing, verification, registry management', product_id = '11111111-1111-1111-1111-111111111111', status = 'active'
WHERE name = 'Carbon Operations';

UPDATE departments SET 
  name = 'Growth', code = 'GROWTH', description = 'Sales, Partnerships, Customer Success - revenue and retention', product_id = '11111111-1111-1111-1111-111111111111', status = 'active'
WHERE name = 'Sales';

-- Landing/Marketing departments
UPDATE departments SET 
  name = 'Marketing', code = 'MKT', description = 'Content/SEO, Social/Community, Growth Marketing - traffic and leads', product_id = '22222222-2222-2222-2222-222222222222', status = 'active'
WHERE name = 'Marketing';

UPDATE departments SET 
  name = 'Design', code = 'DES', description = 'Web Design, Brand Assets - landing pages, conversion optimization', product_id = '22222222-2222-2222-2222-222222222222', status = 'active'
WHERE name = 'Design';

-- Internal Ops departments
UPDATE departments SET 
  name = 'Finance & Accounting', code = 'FIN', description = 'Accounting, Payroll, Controller - books, compliance, payouts', product_id = '33333333-3333-3333-3333-333333333333', status = 'active'
WHERE name = 'Finance';

UPDATE departments SET 
  name = 'People Operations', code = 'HR', description = 'Recruiting, HR Generalist - hiring, onboarding, policies', product_id = '33333333-3333-3333-3333-333333333333', status = 'active'
WHERE name = 'Human Resources';

UPDATE departments SET 
  name = 'Legal & Compliance', code = 'LEG', description = 'Legal Counsel - contracts, IP, data privacy, compliance', product_id = '33333333-3333-3333-3333-333333333333', status = 'active'
WHERE name = 'Legal & Compliance';

UPDATE departments SET 
  name = 'Internal Tools', code = 'ITOOLS', description = 'Full-stack Engineers - build/maintain ops.ethertrack.in, agent, integrations', product_id = '33333333-3333-3333-3333-333333333333', status = 'active'
WHERE name = 'Administration';

-- Deactivate old departments
UPDATE departments SET status = 'inactive' WHERE name = 'Accounts';

-- ============================================================
-- TEAMS under each department
-- ============================================================

-- Teams for Engineering (EtherTrack)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Backend', d.id, NULL FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Frontend', d.id, NULL FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'DevOps', d.id, NULL FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'QA', d.id, NULL FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Teams for Product (EtherTrack)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Product Management', d.id, NULL FROM departments d WHERE d.name = 'Product' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Product Design', d.id, NULL FROM departments d WHERE d.name = 'Product' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Teams for Carbon Operations (EtherTrack)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Carbon Analysts', d.id, NULL FROM departments d WHERE d.name = 'Carbon Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Registry & Verification', d.id, NULL FROM departments d WHERE d.name = 'Carbon Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Teams for Growth (EtherTrack)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Enterprise Sales', d.id, NULL FROM departments d WHERE d.name = 'Growth' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Partnerships', d.id, NULL FROM departments d WHERE d.name = 'Growth' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Customer Success', d.id, NULL FROM departments d WHERE d.name = 'Growth' AND d.product_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Teams for Marketing (Landing)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Content & SEO', d.id, NULL FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Social & Community', d.id, NULL FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Growth Marketing', d.id, NULL FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT DO NOTHING;

-- Teams for Design (Landing)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Web Design', d.id, NULL FROM departments d WHERE d.name = 'Design' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Brand Assets', d.id, NULL FROM departments d WHERE d.name = 'Design' AND d.product_id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT DO NOTHING;

-- Teams for Finance & Accounting (Internal Ops)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Accounting', d.id, NULL FROM departments d WHERE d.name = 'Finance & Accounting' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Payroll', d.id, NULL FROM departments d WHERE d.name = 'Finance & Accounting' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Controller', d.id, NULL FROM departments d WHERE d.name = 'Finance & Accounting' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

-- Teams for People Operations (Internal Ops)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Recruiting', d.id, NULL FROM departments d WHERE d.name = 'People Operations' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'HR Operations', d.id, NULL FROM departments d WHERE d.name = 'People Operations' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

-- Teams for Legal & Compliance (Internal Ops)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Legal', d.id, NULL FROM departments d WHERE d.name = 'Legal & Compliance' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

-- Teams for Internal Tools (Internal Ops)
INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Platform Engineering', d.id, NULL FROM departments d WHERE d.name = 'Internal Tools' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

INSERT INTO teams (name, department_id, team_head_id)
SELECT 'Integrations', d.id, NULL FROM departments d WHERE d.name = 'Internal Tools' AND d.product_id = '33333333-3333-3333-3333-333333333333'
ON CONFLICT DO NOTHING;

-- ============================================================
-- HIRING PLANS per team (realistic for solo founder -> 15 people)
-- ============================================================

-- Helper: delete old hiring plans for these products
DELETE FROM product_hiring_plans WHERE product_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- ETHERTRACK CORE HIRING PLANS
-- Engineering teams
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Backend Engineer', d.id, 2, 0, 'high', '2026-12-31', 'API, marketplace, carbon credit engine'
FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Frontend Engineer', d.id, 2, 0, 'high', '2026-12-31', 'React/Next.js dashboard, marketplace UI'
FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'DevOps Engineer', d.id, 1, 0, 'medium', '2027-03-31', 'AWS, CI/CD, monitoring, agent infra'
FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'QA Engineer', d.id, 1, 0, 'low', '2027-06-30', 'Automated testing, regression suite'
FROM departments d WHERE d.name = 'Engineering' AND d.product_id = '11111111-1111-1111-1111-111111111111';

-- Product teams
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Product Manager', d.id, 1, 0, 'critical', '2026-09-30', 'Own roadmap, marketplace, carbon features'
FROM departments d WHERE d.name = 'Product' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Product Designer', d.id, 1, 0, 'high', '2026-10-31', 'User research, UI/UX for complex workflows'
FROM departments d WHERE d.name = 'Product' AND d.product_id = '11111111-1111-1111-1111-111111111111';

-- Carbon Operations teams
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Carbon Analyst', d.id, 2, 0, 'critical', '2026-09-30', 'Project due diligence, registry mgmt, credit quality'
FROM departments d WHERE d.name = 'Carbon Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Carbon Operations Lead', d.id, 1, 0, 'high', '2026-10-31', 'Supplier relationships, verification pipeline'
FROM departments d WHERE d.name = 'Carbon Operations' AND d.product_id = '11111111-1111-1111-1111-111111111111';

-- Growth teams
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Enterprise Sales Lead', d.id, 1, 0, 'critical', '2026-09-30', 'Sell to corporates, project developers'
FROM departments d WHERE d.name = 'Growth' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'SDR/BDR', d.id, 2, 0, 'high', '2026-11-30', 'Outbound pipeline generation'
FROM departments d WHERE d.name = 'Growth' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Partnerships Manager', d.id, 1, 0, 'medium', '2027-01-31', 'Registry partners, verifiers, marketplaces'
FROM departments d WHERE d.name = 'Growth' AND d.product_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', 'Customer Success Manager', d.id, 1, 0, 'high', '2026-12-31', 'Onboarding + retention for enterprise'
FROM departments d WHERE d.name = 'Growth' AND d.product_id = '11111111-1111-1111-1111-111111111111';

-- LANDING / MARKETING HIRING PLANS
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Content Marketing Lead', d.id, 1, 0, 'high', '2026-10-31', 'Blog, whitepapers, case studies, SEO'
FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'SEO Specialist', d.id, 1, 0, 'medium', '2027-01-31', 'Technical SEO, keyword strategy'
FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Social Media Manager', d.id, 1, 0, 'low', '2027-03-31', 'LinkedIn, Twitter, community'
FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Growth Marketer', d.id, 1, 0, 'high', '2026-11-30', 'Paid acquisition, conversion optimization'
FROM departments d WHERE d.name = 'Marketing' AND d.product_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Product Designer (Marketing)', d.id, 1, 0, 'high', '2026-10-31', 'Landing pages, conversion optimization'
FROM departments d WHERE d.name = 'Design' AND d.product_id = '22222222-2222-2222-2222-222222222222';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '22222222-2222-2222-2222-222222222222', 'Brand Designer', d.id, 1, 0, 'medium', '2027-01-31', 'Brand assets, visual identity'
FROM departments d WHERE d.name = 'Design' AND d.product_id = '22222222-2222-2222-2222-222222222222';

-- INTERNAL OPS HIRING PLANS
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Finance Controller', d.id, 1, 0, 'critical', '2026-09-30', 'Monthly close, GST, TDS, board reporting'
FROM departments d WHERE d.name = 'Finance & Accounting' AND d.product_id = '33333333-3333-3333-3333-333333333333';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Accountant', d.id, 1, 0, 'high', '2026-10-31', 'AP/AR, reconciliations, vendor mgmt'
FROM departments d WHERE d.name = 'Finance & Accounting' AND d.product_id = '33333333-3333-3333-3333-333333333333';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Payroll Specialist', d.id, 1, 0, 'medium', '2027-01-31', 'Razorpay payouts, PF/ESI, compliance'
FROM departments d WHERE d.name = 'Finance & Accounting' AND d.product_id = '33333333-3333-3333-3333-333333333333';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Recruiter', d.id, 1, 0, 'high', '2026-09-30', 'Full-cycle hiring for all 3 products'
FROM departments d WHERE d.name = 'People Operations' AND d.product_id = '33333333-3333-3333-3333-333333333333';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'HR Generalist', d.id, 1, 0, 'medium', '2027-01-31', 'Onboarding, policies, engagement, compliance'
FROM departments d WHERE d.name = 'People Operations' AND d.product_id = '33333333-3333-3333-3333-333333333333';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Legal Counsel', d.id, 1, 0, 'high', '2026-12-31', 'Contracts, IP, data privacy, compliance'
FROM departments d WHERE d.name = 'Legal & Compliance' AND d.product_id = '33333333-3333-3333-3333-333333333333';

INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT '33333333-3333-3333-3333-333333333333', 'Full Stack Engineer (Internal Tools)', d.id, 2, 0, 'high', '2026-11-30', 'Build/maintain ops tool, agent, integrations'
FROM departments d WHERE d.name = 'Internal Tools' AND d.product_id = '33333333-3333-3333-3333-333333333333';

-- Refresh current counts from actual employees
SELECT refresh_product_hiring_counts();