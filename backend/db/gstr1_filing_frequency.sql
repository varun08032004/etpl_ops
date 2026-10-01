-- Add GSTR-1 filing frequency setting to compliance_settings
INSERT INTO compliance_settings (key, value, note) VALUES
('gstr1_filing_frequency', 'monthly', 'GSTR-1 filing frequency: "monthly" or "quarterly" (QRMP scheme for turnover <=5Cr)')
ON CONFLICT (key) DO NOTHING;