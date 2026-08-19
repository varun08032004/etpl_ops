const fs = require('fs');

let content = fs.readFileSync('db/009_missing_tables.sql', 'utf8');

// Remove non-ASCII characters
content = content.replace(/[^\x00-\x7F]/g, '');

// Fix comments that cause syntax issues
content = content.replace(/-- Canonical schema \(from finance.js\): category as free text, approval chain via levels_required/, '-- Canonical schema (from finance.js): category as free text approval chain via levels_required');
content = content.replace(/-- The old expenseClaims.js used category_id FK \+ manager->finance flow; kept for reference but finance.js is canonical/, '-- The old expenseClaims.js used category_id FK manager-finance flow kept for reference but finance.js is canonical');
content = content.replace(/-- ##################################################################################/g, '');
content = content.replace(/-- Seed default discount approval threshold/, '-- Seed default discount approval threshold');
content = content.replace(/-- REFRESH TOKENS.*$/gm, '-- REFRESH TOKENS');
content = content.replace(/-- GRANTS \/ RLS PREPARATION.*$/gm, '');
content = content.replace(/-- ##################################################################################/g, '');
content = content.replace(/-- FAILED LOGIN ATTEMPTS.*$/gm, '-- FAILED LOGIN ATTEMPTS');
content = content.replace(/-- AUDIT LOG ENHANCEMENTS.*$/gm, '-- AUDIT LOG ENHANCEMENTS');
content = content.replace(/-- GRANTS \/ RLS PREPARATION.*$/gm, '');
content = content.replace(/-- FX RATE CACHE.*$/gm, '-- FX RATE CACHE');
content = content.replace(/-- RECURRING EXPENSE AUDIT LOG.*$/gm, '-- RECURRING EXPENSE AUDIT LOG');
content = content.replace(/-- EXPENSE BANK TRANSACTIONS.*$/gm, '-- EXPENSE BANK TRANSACTIONS');
content = content.replace(/-- EXISTING TABLES FROM SCHEMA.SQL.*$/gm, '-- EXISTING TABLES FROM SCHEMA.SQL');
content = content.replace(/-- EMPLOYEES.*$/gm, '-- EMPLOYEES');
content = content.replace(/-- STAFF ACCOUNTS.*$/gm, '-- STAFF ACCOUNTS');
content = content.replace(/-- INVOICES.*$/gm, '-- INVOICES');
content = content.replace(/-- BILLS.*$/gm, '-- BILLS');
content = content.replace(/-- PAYROLL.*$/gm, '-- PAYROLL');
content = content.replace(/-- JOURNAL ENTRIES.*$/gm, '-- JOURNAL ENTRIES');
content = content.replace(/-- DOCUMENTS.*$/gm, '-- DOCUMENTS');
content = content.replace(/-- DEPARTMENTS.*$/gm, '-- DEPARTMENTS');
content = content.replace(/-- GRANTS \/ RLS PREPARATION.*$/gm, '');
content = content.replace(/-- Placeholder policies \(to be refined in Phase 3\).*$/gm, '-- Placeholder policies to be refined in Phase 3');

fs.writeFileSync('db/009_missing_tables.sql', content);
console.log('File cleaned');