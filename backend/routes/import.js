'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');

router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function parseCsv(buffer) {
  return parse(buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
}

// ── Employees bulk import ───────────────────────────────────────────────────
// Expected CSV columns: full_name, work_email, date_of_joining (YYYY-MM-DD),
// employment_type, department, designation, ctc_annual, basic_monthly, hra_monthly,
// other_allowances_monthly, phone, city, state, pan_number
router.post('/employees', requireRole('hr'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required (multipart field name: "file")' });

  let rows;
  try {
    rows = parseCsv(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: `Could not parse CSV: ${err.message}` });
  }
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const results = { created: 0, failed: [] };

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.full_name || !row.date_of_joining) {
        throw new Error('full_name and date_of_joining are required');
      }

      let departmentId = null;
      if (row.department) {
        const { rows: [dept] } = await safeQuery(
          `INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [row.department]
        );
        departmentId = dept.id;
      }

      let designationId = null;
      if (row.designation) {
        const { rows: [existing] } = await safeQuery(`SELECT id FROM designations WHERE title = $1 AND department_id IS NOT DISTINCT FROM $2`, [row.designation, departmentId]);
        if (existing) designationId = existing.id;
        else {
          const { rows: [des] } = await safeQuery(`INSERT INTO designations (title, department_id) VALUES ($1,$2) RETURNING id`, [row.designation, departmentId]);
          designationId = des.id;
        }
      }

      const { rows: [{ next_code }] } = await safeQuery(
        `SELECT 'ET-EMP-' || LPAD((COALESCE(MAX(SUBSTRING(employee_code FROM '\\d+$')::int), 0) + 1)::text, 4, '0') AS next_code FROM employees`
      );

      await safeQuery(
        `INSERT INTO employees (employee_code, full_name, work_email, phone, city, state, pan_number,
           department_id, designation_id, employment_type, date_of_joining,
           ctc_annual, basic_monthly, hra_monthly, other_allowances_monthly)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [next_code, row.full_name, row.work_email || null, row.phone || null, row.city || null,
         row.state || null, row.pan_number || null, departmentId, designationId,
         row.employment_type || 'full_time', row.date_of_joining,
         row.ctc_annual || null, row.basic_monthly || null, row.hra_monthly || null, row.other_allowances_monthly || null]
      );
      results.created++;
    } catch (err) {
      results.failed.push({ row: i + 2, name: row.full_name || '(no name)', reason: err.message }); // +2: header row + 1-index
    }
  }

  res.json(results);
});

// ── Parties (customers/vendors) bulk import ─────────────────────────────────
// Expected CSV columns: name, party_type (customer|vendor|both), email, phone, gstin,
// billing_address, state, payment_terms_days
router.post('/parties', requireRole('finance'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required (multipart field name: "file")' });
  let rows;
  try { rows = parseCsv(req.file.buffer); } catch (err) { return res.status(400).json({ error: `Could not parse CSV: ${err.message}` }); }
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const results = { created: 0, failed: [] };
  for (const [i, row] of rows.entries()) {
    try {
      if (!row.name) throw new Error('name is required');
      await safeQuery(
        `INSERT INTO parties (name, party_type, email, phone, gstin, billing_address, state, payment_terms_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [row.name, row.party_type || 'customer', row.email || null, row.phone || null, row.gstin || null,
         row.billing_address || null, row.state || null, row.payment_terms_days || 30]
      );
      results.created++;
    } catch (err) {
      results.failed.push({ row: i + 2, name: row.name || '(no name)', reason: err.message });
    }
  }
  res.json(results);
});

// ── Invoices bulk import ────────────────────────────────────────────────────
// Expected CSV columns: party_name (must already exist as a party), invoice_date, due_date,
// description, quantity, unit_price, gst_rate, hsn_sac_code
// One row = one line item; multiple rows with the same party_name + invoice_date get grouped
// into a single invoice with multiple line items.
router.post('/invoices', requireRole('finance'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required (multipart field name: "file")' });
  let rows;
  try { rows = parseCsv(req.file.buffer); } catch (err) { return res.status(400).json({ error: `Could not parse CSV: ${err.message}` }); }
  if (!rows.length) return res.status(400).json({ error: 'CSV has no data rows' });

  const HOME_STATE = process.env.COMPANY_STATE || 'Maharashtra';
  const groups = new Map(); // key: party_name|invoice_date -> { rows, due_date }
  for (const row of rows) {
    const key = `${row.party_name}|${row.invoice_date}`;
    if (!groups.has(key)) groups.set(key, { party_name: row.party_name, invoice_date: row.invoice_date, due_date: row.due_date, items: [] });
    groups.get(key).items.push(row);
  }

  const results = { invoicesCreated: 0, failed: [] };

  for (const group of groups.values()) {
    try {
      const { rows: [party] } = await safeQuery(`SELECT * FROM parties WHERE name = $1`, [group.party_name]);
      if (!party) throw new Error(`No party found named "${group.party_name}" — import parties first`);

      const isInterState = party.state && party.state.trim().toLowerCase() !== HOME_STATE.trim().toLowerCase();
      let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
      const round2 = (n) => Math.round(n * 100) / 100;

      const { rows: [defaultIncomeAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '4200'`);
      const { rows: [arAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
      const { rows: [cgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2210'`);
      const { rows: [sgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2220'`);
      const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2230'`);

      const computedItems = group.items.map((it) => {
        const lineTotal = Number(it.quantity || 1) * Number(it.unit_price);
        const gstRate = Number(it.gst_rate ?? 18);
        const gstAmount = (lineTotal * gstRate) / 100;
        subtotal += lineTotal;
        if (isInterState) igstTotal += gstAmount; else { cgstTotal += gstAmount / 2; sgstTotal += gstAmount / 2; }
        return { ...it, lineTotal, gstRate };
      });
      subtotal = round2(subtotal); cgstTotal = round2(cgstTotal); sgstTotal = round2(sgstTotal); igstTotal = round2(igstTotal);
      const totalAmount = round2(subtotal + cgstTotal + sgstTotal + igstTotal);

      const { rows: [{ next_num }] } = await safeQuery(
        `SELECT 'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                LPAD((COALESCE(MAX(SUBSTRING(invoice_number FROM '\\d+$')::int), 0) + 1)::text, 6, '0') AS next_num
         FROM invoices WHERE invoice_number LIKE 'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
      );

      const { rows: [invoice] } = await safeQuery(
        `INSERT INTO invoices (invoice_number, party_id, invoice_date, due_date, status, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, place_of_supply, created_by)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [next_num, party.id, group.invoice_date, group.due_date || group.invoice_date, subtotal, cgstTotal, sgstTotal, igstTotal, totalAmount, party.state || null, req.staff.id]
      );

      for (const it of computedItems) {
        await safeQuery(
          `INSERT INTO invoice_items (invoice_id, description, hsn_sac_code, quantity, unit_price, gst_rate, line_total, income_account_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [invoice.id, it.description || 'Item', it.hsn_sac_code || null, it.quantity || 1, it.unit_price, it.gstRate, it.lineTotal, defaultIncomeAcct.id]
        );
      }

      const lines = [
        { accountId: arAcct.id, debit: totalAmount, partyId: party.id, description: `Invoice ${invoice.invoice_number}` },
        { accountId: defaultIncomeAcct.id, credit: subtotal, description: `Revenue - ${invoice.invoice_number}` },
      ];
      if (cgstTotal > 0) lines.push({ accountId: cgstAcct.id, credit: cgstTotal, description: 'CGST output' });
      if (sgstTotal > 0) lines.push({ accountId: sgstAcct.id, credit: sgstTotal, description: 'SGST output' });
      if (igstTotal > 0) lines.push({ accountId: igstAcct.id, credit: igstTotal, description: 'IGST output' });

      const je = await ledger.postJournalEntry({
        entryDate: group.invoice_date, source: 'invoice', sourceType: 'invoice', sourceId: invoice.id,
        narration: `Invoice ${invoice.invoice_number} to ${party.name} (bulk import)`, createdBy: req.staff.id, lines,
      });
      await safeQuery(`UPDATE invoices SET journal_entry_id = $1, status = 'sent' WHERE id = $2`, [je.id, invoice.id]);

      results.invoicesCreated++;
    } catch (err) {
      results.failed.push({ party: group.party_name, date: group.invoice_date, reason: err.message });
    }
  }

  res.json(results);
});

module.exports = router;
