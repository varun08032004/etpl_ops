-- Migration 056: Final Org Structure with 8 Departments & Role-Based Access
-- Hierarchy: Founder/MD/Directors (L0) -> CEO (L1) -> 8 Dept HODs (L2) -> Employees (L3)

-- 1. Fix org hierarchy tiers to exactly 4 levels
DELETE FROM org_hierarchy_tiers;

INSERT INTO org_hierarchy_tiers (id, name, display_order, description, color, is_system) VALUES
  ('tier-0', 'Founder / Managing Director / Director', 0, 'Top leadership - full company access, no department', '#7c3aed', TRUE),
  ('tier-1', 'CEO', 10, 'Chief Executive Officer - full company access, no department', '#5b21b6', TRUE),
  ('tier-2', 'HOD (Head of Department)', 20, 'Department Head - admin access to their department', '#3730a3', TRUE),
  ('tier-3', 'Employee', 30, 'Individual contributor - department-level access', '#166534', TRUE);

-- 2. Reset departments to exactly 8
-- First deactivate all
UPDATE departments SET status = 'inactive';

-- 8 Core Departments
INSERT INTO departments (id, name, code, description, status, head_employee_id, granted_roles) VALUES
  ('dept-hr', 'Human Resources', 'HR', 'Recruitment, onboarding, policies, payroll admin, employee relations', 'active', NULL, ARRAY['hr']),
  ('dept-finance', 'Finance', 'FIN', 'Financial planning, budgeting, treasury, investor relations, board reporting', 'active', NULL, ARRAY['finance']),
  ('dept-accounting', 'Accounting', 'ACCT', 'Bookkeeping, AP/AR, reconciliations, GST, TDS, audit, vendor management', 'active', NULL, ARRAY['accounting']),
  ('dept-legal', 'Legal & Compliance', 'LEG', 'Contracts, IP, data privacy, regulatory compliance, corporate governance', 'active', NULL, ARRAY['legal']),
  ('dept-sales', 'Sales', 'SAL', 'Enterprise sales, partnerships, customer success, revenue operations', 'active', NULL, ARRAY['sales']),
  ('dept-marketing', 'Marketing', 'MKT', 'Brand, content, SEO, social, growth marketing, events, lead generation', 'active', NULL, ARRAY['marketing']),
  ('dept-product-eng', 'Product & Engineering', 'PENG', 'Product management, design, backend, frontend, devops, QA - all product tech', 'active', NULL, ARRAY['product', 'engineering']),
  ('dept-operations', 'Operations', 'OPS', 'Internal operations: passwords, dates, bill payments, admin, IT support, facilities', 'active', NULL, ARRAY['operations'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  granted_roles = EXCLUDED.granted_roles;

-- 3. Teams under each department
DELETE FROM teams WHERE department_id IN (SELECT id FROM departments WHERE status = 'active');

-- HR Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-hr-recruiting', 'Recruiting', 'dept-hr', NULL),
  ('team-hr-operations', 'HR Operations', 'dept-hr', NULL)
ON CONFLICT (id) DO NOTHING;

-- Finance Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-fin-fp', 'Financial Planning', 'dept-finance', NULL),
  ('team-fin-treasury', 'Treasury & Investor Relations', 'dept-finance', NULL)
ON CONFLICT (id) DO NOTHING;

-- Accounting Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-acct-apar', 'AP/AR', 'dept-accounting', NULL),
  ('team-acct-gst', 'GST & Compliance', 'dept-accounting', NULL),
  ('team-acct-payroll', 'Payroll Processing', 'dept-accounting', NULL)
ON CONFLICT (id) DO NOTHING;

-- Legal Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-leg-contracts', 'Contracts & IP', 'dept-legal', NULL),
  ('team-leg-compliance', 'Compliance & Governance', 'dept-legal', NULL)
ON CONFLICT (id) DO NOTHING;

-- Sales Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-sal-enterprise', 'Enterprise Sales', 'dept-sales', NULL),
  ('team-sal-partnerships', 'Partnerships', 'dept-sales', NULL),
  ('team-sal-cs', 'Customer Success', 'dept-sales', NULL)
ON CONFLICT (id) DO NOTHING;

-- Marketing Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-mkt-content', 'Content & SEO', 'dept-marketing', NULL),
  ('team-mkt-growth', 'Growth Marketing', 'dept-marketing', NULL),
  ('team-mkt-brand', 'Brand & Social', 'dept-marketing', NULL)
ON CONFLICT (id) DO NOTHING;

-- Product & Engineering Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-peng-pm', 'Product Management', 'dept-product-eng', NULL),
  ('team-peng-design', 'Product Design', 'dept-product-eng', NULL),
  ('team-peng-backend', 'Backend Engineering', 'dept-product-eng', NULL),
  ('team-peng-frontend', 'Frontend Engineering', 'dept-product-eng', NULL),
  ('team-peng-devops', 'DevOps & QA', 'dept-product-eng', NULL)
ON CONFLICT (id) DO NOTHING;

-- Operations Teams
INSERT INTO teams (id, name, department_id, team_head_id) VALUES
  ('team-ops-admin', 'Admin & IT Support', 'dept-operations', NULL),
  ('team-ops-finance', 'Bill Payments & Finance Ops', 'dept-operations', NULL),
  ('team-ops-security', 'Security & Access Management', 'dept-operations', NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Designations per department (tier-aware)
DELETE FROM designations WHERE department_id IN (SELECT id FROM departments WHERE status = 'active');

-- Tier 0: Founder/MD/Director (no department)
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-founder', 'Founder', NULL, 'tier-0', 0),
  ('desig-md', 'Managing Director', NULL, 'tier-0', 0),
  ('desig-director', 'Director', NULL, 'tier-0', 0)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Tier 1: CEO (no department)
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-ceo', 'CEO', NULL, 'tier-1', 10)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Tier 2: HODs per department
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-hod-hr', 'HOD - Human Resources', 'dept-hr', 'tier-2', 20),
  ('desig-hod-finance', 'HOD - Finance', 'dept-finance', 'tier-2', 20),
  ('desig-hod-accounting', 'HOD - Accounting', 'dept-accounting', 'tier-2', 20),
  ('desig-hod-legal', 'HOD - Legal & Compliance', 'dept-legal', 'tier-2', 20),
  ('desig-hod-sales', 'HOD - Sales', 'dept-sales', 'tier-2', 20),
  ('desig-hod-marketing', 'HOD - Marketing', 'dept-marketing', 'tier-2', 20),
  ('desig-hod-peng', 'HOD - Product & Engineering', 'dept-product-eng', 'tier-2', 20),
  ('desig-hod-ops', 'HOD - Operations', 'dept-operations', 'tier-2', 20)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Tier 3: Employee roles per department
-- HR
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-hr-recruiter', 'Recruiter', 'dept-hr', 'tier-3', 30),
  ('desig-hr-generalist', 'HR Generalist', 'dept-hr', 'tier-3', 30),
  ('desig-hr-payroll', 'Payroll Administrator', 'dept-hr', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Finance
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-fin-analyst', 'Financial Analyst', 'dept-finance', 'tier-3', 30),
  ('desig-fin-controller', 'Financial Controller', 'dept-finance', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Accounting
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-acct-accountant', 'Accountant', 'dept-accounting', 'tier-3', 30),
  ('desig-acct-senior', 'Senior Accountant', 'dept-accounting', 'tier-3', 30),
  ('desig-acct-gst', 'GST Specialist', 'dept-accounting', 'tier-3', 30),
  ('desig-acct-payroll', 'Payroll Specialist', 'dept-accounting', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Legal
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-leg-counsel', 'Legal Counsel', 'dept-legal', 'tier-3', 30),
  ('desig-leg-compliance', 'Compliance Officer', 'dept-legal', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Sales
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-sal-lead', 'Enterprise Sales Lead', 'dept-sales', 'tier-3', 30),
  ('desig-sal-exec', 'Sales Executive', 'dept-sales', 'tier-3', 30),
  ('desig-sal-sdr', 'SDR/BDR', 'dept-sales', 'tier-3', 30),
  ('desig-sal-partner', 'Partnerships Manager', 'dept-sales', 'tier-3', 30),
  ('desig-sal-csm', 'Customer Success Manager', 'dept-sales', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Marketing
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-mkt-content', 'Content Marketing Lead', 'dept-marketing', 'tier-3', 30),
  ('desig-mkt-growth', 'Growth Marketer', 'dept-marketing', 'tier-3', 30),
  ('desig-mkt-seo', 'SEO Specialist', 'dept-marketing', 'tier-3', 30),
  ('desig-mkt-social', 'Social Media Manager', 'dept-marketing', 'tier-3', 30),
  ('desig-mkt-brand', 'Brand Designer', 'dept-marketing', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Product & Engineering
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-peng-pm', 'Product Manager', 'dept-product-eng', 'tier-3', 30),
  ('desig-peng-designer', 'Product Designer', 'dept-product-eng', 'tier-3', 30),
  ('desig-peng-backend', 'Backend Engineer', 'dept-product-eng', 'tier-3', 30),
  ('desig-peng-frontend', 'Frontend Engineer', 'dept-product-eng', 'tier-3', 30),
  ('desig-peng-devops', 'DevOps Engineer', 'dept-product-eng', 'tier-3', 30),
  ('desig-peng-qa', 'QA Engineer', 'dept-product-eng', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- Operations
INSERT INTO designations (id, title, department_id, tier_id, level) VALUES
  ('desig-ops-admin', 'Admin & IT Support', 'dept-operations', 'tier-3', 30),
  ('desig-ops-finance', 'Finance Operations', 'dept-operations', 'tier-3', 30),
  ('desig-ops-security', 'Security & Access Manager', 'dept-operations', 'tier-3', 30)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, tier_id = EXCLUDED.tier_id, level = EXCLUDED.level;

-- 5. Assign top leadership (no department)
UPDATE employees SET designation_id = 'desig-founder' WHERE employee_code = 'ET-EMP-0001'; -- Varun = Founder
UPDATE employees SET designation_id = 'desig-md' WHERE employee_code = 'ET-EMP-0002'; -- Girish = MD
UPDATE employees SET designation_id = 'desig-director' WHERE employee_code IN ('ET-EMP-0003', 'ET-EMP-0004', 'ET-EMP-0005'); -- Archana, Sharvari, Tejas = Directors

-- 6. Assign HODs to departments
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE employee_code = 'ET-EMP-0003') WHERE id = 'dept-finance'; -- Archana -> Finance
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE employee_code = 'ET-EMP-0004') WHERE id = 'dept-marketing'; -- Sharvari -> Marketing
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE employee_code = 'ET-EMP-0005') WHERE id = 'dept-product-eng'; -- Tejas -> Product & Eng
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE employee_code = 'ET-EMP-0002') WHERE id = 'dept-operations'; -- Girish (MD) -> Operations

-- Update HOD designations
UPDATE employees SET designation_id = 'desig-hod-finance' WHERE employee_code = 'ET-EMP-0003';
UPDATE employees SET designation_id = 'desig-hod-marketing' WHERE employee_code = 'ET-EMP-0004';
UPDATE employees SET designation_id = 'desig-hod-peng' WHERE employee_code = 'ET-EMP-0005';

-- 7. Hiring plans per department (realistic targets)
DELETE FROM product_hiring_plans;

-- HR
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Recruiter', 'dept-hr', 1, 0, 'high', '2026-09-30', 'Full-cycle hiring' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'HR Generalist', 'dept-hr', 1, 0, 'medium', '2027-01-31', 'Onboarding, policies' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'Payroll Administrator', 'dept-hr', 1, 0, 'medium', '2027-01-31', 'Payroll processing' FROM products p WHERE p.slug = 'ops';

-- Finance
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Financial Analyst', 'dept-finance', 1, 0, 'high', '2026-10-31', 'FP&A, budgeting' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'Financial Controller', 'dept-finance', 1, 0, 'critical', '2026-09-30', 'Monthly close, board reporting' FROM products p WHERE p.slug = 'ops';

-- Accounting
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Accountant', 'dept-accounting', 1, 0, 'high', '2026-10-31', 'AP/AR, reconciliations' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'GST Specialist', 'dept-accounting', 1, 0, 'high', '2026-10-31', 'GST filing, TDS' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'Payroll Specialist', 'dept-accounting', 1, 0, 'medium', '2027-01-31', 'Razorpay payouts, PF/ESI' FROM products p WHERE p.slug = 'ops';

-- Legal
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Legal Counsel', 'dept-legal', 1, 0, 'high', '2026-12-31', 'Contracts, IP, privacy' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'Compliance Officer', 'dept-legal', 1, 0, 'medium', '2027-03-31', 'Regulatory compliance' FROM products p WHERE p.slug = 'ops';

-- Sales
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Enterprise Sales Lead', 'dept-sales', 1, 0, 'critical', '2026-09-30', 'Corporate sales' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'Sales Executive', 'dept-sales', 2, 0, 'high', '2026-11-30', 'Pipeline generation' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'SDR/BDR', 'dept-sales', 2, 0, 'high', '2026-11-30', 'Outbound prospecting' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'Partnerships Manager', 'dept-sales', 1, 0, 'medium', '2027-01-31', 'Registry/verifier partners' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'Customer Success Manager', 'dept-sales', 1, 0, 'high', '2026-12-31', 'Onboarding, retention' FROM products p WHERE p.slug = 'ethertrack';

-- Marketing
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Content Marketing Lead', 'dept-marketing', 1, 0, 'high', '2026-10-31', 'Blog, whitepapers, SEO' FROM products p WHERE p.slug = 'landing'
UNION ALL SELECT p.id, 'Growth Marketer', 'dept-marketing', 1, 0, 'high', '2026-11-30', 'Paid acquisition' FROM products p WHERE p.slug = 'landing'
UNION ALL SELECT p.id, 'SEO Specialist', 'dept-marketing', 1, 0, 'medium', '2027-01-31', 'Technical SEO' FROM products p WHERE p.slug = 'landing'
UNION ALL SELECT p.id, 'Social Media Manager', 'dept-marketing', 1, 0, 'low', '2027-03-31', 'LinkedIn, Twitter' FROM products p WHERE p.slug = 'landing'
UNION ALL SELECT p.id, 'Brand Designer', 'dept-marketing', 1, 0, 'medium', '2027-01-31', 'Brand assets' FROM products p WHERE p.slug = 'landing';

-- Product & Engineering
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Product Manager', 'dept-product-eng', 2, 0, 'critical', '2026-09-30', 'Roadmap for all products' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'Product Designer', 'dept-product-eng', 2, 0, 'high', '2026-10-31', 'UX for platform + landing' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'Backend Engineer', 'dept-product-eng', 3, 0, 'high', '2026-12-31', 'Core platform, APIs' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'Frontend Engineer', 'dept-product-eng', 3, 0, 'high', '2026-12-31', 'Dashboard, marketplace UI' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'DevOps Engineer', 'dept-product-eng', 1, 0, 'medium', '2027-03-31', 'AWS, CI/CD, monitoring' FROM products p WHERE p.slug = 'ethertrack'
UNION ALL SELECT p.id, 'QA Engineer', 'dept-product-eng', 1, 0, 'low', '2027-06-30', 'Automated testing' FROM products p WHERE p.slug = 'ethertrack';

-- Operations
INSERT INTO product_hiring_plans (product_id, role_title, department_id, target_count, current_count, priority, target_date, notes)
SELECT p.id, 'Admin & IT Support', 'dept-operations', 1, 0, 'high', '2026-10-31', 'Internal tools, passwords, access' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'Finance Operations', 'dept-operations', 1, 0, 'high', '2026-10-31', 'Bill payments, vendor mgmt' FROM products p WHERE p.slug = 'ops'
UNION ALL SELECT p.id, 'Security & Access Manager', 'dept-operations', 1, 0, 'medium', '2027-01-31', 'Access control, passwords' FROM products p WHERE p.slug = 'ops';

-- Refresh counts
SELECT refresh_product_hiring_counts();