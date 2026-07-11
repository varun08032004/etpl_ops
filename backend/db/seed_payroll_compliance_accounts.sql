INSERT INTO chart_of_accounts (code, name, account_type, is_group) VALUES
('2420', 'ESIC Payable',                  'liability', false),
('5120', 'Employer ESIC Contribution',    'expense', false)
ON CONFLICT (code) DO NOTHING;