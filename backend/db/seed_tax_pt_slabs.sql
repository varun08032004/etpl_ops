-- FY2026-27 tax slabs — verified via web search against Budget 2026 coverage
-- (slabs unchanged from FY2025-26). VERIFY WITH YOUR CA before relying on
-- this for real payroll.

INSERT INTO tax_slabs (regime, fiscal_year, income_from, income_to, rate_percent, standard_deduction, cess_percent) VALUES
('new', 'FY2026-27',       0,  400000,  0, 75000, 4),
('new', 'FY2026-27',  400000,  800000,  5, 75000, 4),
('new', 'FY2026-27',  800000, 1200000, 10, 75000, 4),
('new', 'FY2026-27', 1200000, 1600000, 15, 75000, 4),
('new', 'FY2026-27', 1600000, 2000000, 20, 75000, 4),
('new', 'FY2026-27', 2000000, 2400000, 25, 75000, 4),
('new', 'FY2026-27', 2400000,   NULL,  30, 75000, 4);

INSERT INTO tax_slabs (regime, fiscal_year, income_from, income_to, rate_percent, standard_deduction, cess_percent) VALUES
('old', 'FY2026-27',      0,  250000,  0, 50000, 4),
('old', 'FY2026-27', 250000,  500000,  5, 50000, 4),
('old', 'FY2026-27', 500000, 1000000, 20, 50000, 4),
('old', 'FY2026-27',1000000,   NULL,  30, 50000, 4);

-- Professional Tax — VERIFY against your state's latest PT Act notification.
INSERT INTO pt_slabs (state, gross_from, gross_to, monthly_amount) VALUES
('Maharashtra',     0,   7500,    0),
('Maharashtra',  7500,  10000,  175),
('Maharashtra', 10000,   NULL,  200);

INSERT INTO pt_slabs (state, gross_from, gross_to, monthly_amount) VALUES
('Karnataka',      0,  25000,    0),
('Karnataka',  25000,   NULL,  200);

INSERT INTO pt_slabs (state, gross_from, gross_to, monthly_amount) VALUES
('Delhi', 0, NULL, 0);

INSERT INTO pt_slabs (state, gross_from, gross_to, monthly_amount) VALUES
('Tamil Nadu',      0,  21000,     0),
('Tamil Nadu',  21000,  30000,   100),
('Tamil Nadu',  30000,  45000,   235),
('Tamil Nadu',  45000,  60000,   510),
('Tamil Nadu',  60000,  75000,   760),
('Tamil Nadu',  75000,   NULL,  1095);