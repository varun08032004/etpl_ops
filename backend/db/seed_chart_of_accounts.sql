-- ═══════════════════════════════════════════════════════════════════════════
-- Standard Chart of Accounts for an Indian software startup (EtherTrack)
-- Run once after schema.sql. Codes follow conventional numbering:
--   1xxx Assets · 2xxx Liabilities · 3xxx Equity · 4xxx Income · 5xxx Expenses
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO chart_of_accounts (code, name, account_type, is_group) VALUES
-- ASSETS
('1000', 'Assets',                        'asset', true),
('1100', 'Bank Accounts',                 'asset', true),
('1110', 'HDFC Current Account',          'asset', false),
('1200', 'Accounts Receivable',           'asset', false),
('1300', 'Cash in Hand',                  'asset', false),
('1400', 'Input GST (ITC)',               'asset', false),
('1410', 'Input CGST',                    'asset', false),
('1420', 'Input SGST',                    'asset', false),
('1430', 'Input IGST',                    'asset', false),
('1500', 'Prepaid Expenses',              'asset', false),
('1600', 'Fixed Assets',                  'asset', true),
('1610', 'Computers & Equipment',         'asset', false),
('1620', 'Accumulated Depreciation',      'asset', false),

-- LIABILITIES
('2000', 'Liabilities',                   'liability', true),
('2100', 'Accounts Payable',              'liability', false),
('2200', 'Output GST Payable',            'liability', true),
('2210', 'Output CGST',                   'liability', false),
('2220', 'Output SGST',                   'liability', false),
('2230', 'Output IGST',                   'liability', false),
('2300', 'TDS Payable',                   'liability', false),
('2400', 'PF Payable (Employer + Employee)', 'liability', false),
('2410', 'Professional Tax Payable',      'liability', false),
('2500', 'Salaries Payable',              'liability', false),
('2600', 'Accrued Expenses',              'liability', false),

-- EQUITY
('3000', 'Equity',                        'equity', true),
('3100', 'Owner Capital',                 'equity', false),
('3200', 'Retained Earnings',             'equity', false),

-- INCOME
('4000', 'Income',                        'income', true),
('4100', 'Subscription Revenue',          'income', false),
('4200', 'Services Revenue',              'income', false),
('4900', 'Other Income',                  'income', false),

-- EXPENSES
('5000', 'Expenses',                      'expense', true),
('5100', 'Salaries & Wages',              'expense', false),
('5110', 'Employer PF Contribution',      'expense', false),
('5200', 'Rent',                          'expense', false),
('5300', 'Software & SaaS Tools',         'expense', false),
('5310', 'Cloud Hosting (AWS/GCP/Azure)', 'expense', false),
('5400', 'Contractor & Freelancer Fees',  'expense', false),
('5500', 'Travel & Conveyance',           'expense', false),
('5600', 'Marketing & Advertising',       'expense', false),
('5700', 'Legal & Professional Fees',     'expense', false),
('5800', 'Bank Charges & Payment Gateway Fees', 'expense', false),
('5900', 'Office Supplies & Utilities',   'expense', false),
('5950', 'Depreciation Expense',          'expense', false),
('5990', 'Miscellaneous Expenses',        'expense', false);

-- Wire up parent_id for group headers
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code='1100') WHERE code='1110';
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code='1400') WHERE code IN ('1410','1420','1430');
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code='1600') WHERE code IN ('1610','1620');
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code='2200') WHERE code IN ('2210','2220','2230');

-- Default bank account linked to ledger
INSERT INTO bank_accounts (account_name, bank_name, ledger_account_id, opening_balance)
VALUES ('EtherTrack Current A/C', 'HDFC Bank',
        (SELECT id FROM chart_of_accounts WHERE code='1110'), 0);

-- Default expense categories mapped to accounts
INSERT INTO expense_categories (name, expense_account_id) VALUES
('Cloud Hosting',   (SELECT id FROM chart_of_accounts WHERE code='5310')),
('SaaS Tools',      (SELECT id FROM chart_of_accounts WHERE code='5300')),
('Contractors',     (SELECT id FROM chart_of_accounts WHERE code='5400')),
('Travel',          (SELECT id FROM chart_of_accounts WHERE code='5500')),
('Marketing',       (SELECT id FROM chart_of_accounts WHERE code='5600')),
('Legal & Professional', (SELECT id FROM chart_of_accounts WHERE code='5700')),
('Office & Utilities', (SELECT id FROM chart_of_accounts WHERE code='5900'));

-- Default leave types
INSERT INTO leave_types (name, days_per_year, is_paid) VALUES
('Annual Leave', 18, true),
('Sick Leave', 8, true),
('Casual Leave', 6, true),
('Unpaid Leave', 0, false);
