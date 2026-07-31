'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');

router.use(authenticate);

const HOME_STATE = process.env.COMPANY_STATE || 'Maharashtra'; // same env var invoices.js uses — keep in sync

const round2 = (n) => Math.round(n * 100) / 100;

// ── create a one-off expense / vendor bill ──────────────────────────────────
// This is what was missing: recurring_expenses covers subscriptions and
// contracts, but there was no way to record a single ad-hoc expense (a one-time
// vendor invoice, a reimbursable purchase, a bank-fee, etc.) and have it
// actually hit the ledger. GST logic mirrors routes/invoices.js exactly, just
// on the input/ITC side: intra-state -> split Input CGST + Input SGST,
// inter-state -> Input IGST, credited... no, DEBITED, since ITC is a
// recoverable asset (1410/1420/1430) rather than a liability.
router.post('/', requireRole('finance'), async (req, res) => {
  try {
    const {
      vendor_id, category_id, bill_date, due_date, description,
      subtotal, gst_rate, expense_account_id, pay_immediately, bank_account_id,
    } = req.body;

    if (!vendor_id || !bill_date || !subtotal) {
      return res.status(400).json({ error: 'vendor_id, bill_date, subtotal are required' });
    }
    if (pay_immediately && !bank_account_id) {
      return res.status(400).json({ error: 'bank_account_id is required when pay_immediately is true' });
    }

    const { rows: [vendor] } = await safeQuery(`SELECT * FROM parties WHERE id = $1`, [vendor_id]);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    // Resolve the expense (debit) account: explicit override > category default > error.
    let expenseAcctId = expense_account_id || null;
    if (!expenseAcctId && category_id) {
      const { rows: [cat] } = await safeQuery(`SELECT expense_account_id FROM expense_categories WHERE id = $1`, [category_id]);
      expenseAcctId = cat?.expense_account_id || null;
    }
    if (!expenseAcctId) return res.status(400).json({ error: 'expense_account_id is required (or pick a category with a default expense account)' });

    const isInterState = vendor.state && vendor.state.trim().toLowerCase() !== HOME_STATE.trim().toLowerCase();
    const sub = round2(Number(subtotal));
    const rate = Number(gst_rate ?? 0);
    const gstAmount = round2((sub * rate) / 100);
    const cgst = isInterState ? 0 : round2(gstAmount / 2);
    const sgst = isInterState ? 0 : round2(gstAmount / 2);
    const igst = isInterState ? gstAmount : 0;
    const totalAmount = round2(sub + cgst + sgst + igst);

    const [{ rows: [expenseAcct] }, { rows: [apAcct] }, { rows: [cgstAcct] }, { rows: [sgstAcct] }, { rows: [igstAcct] }, { rows: [bank] }] =
      await Promise.all([
        safeQuery(`SELECT id FROM chart_of_accounts WHERE id = $1`, [expenseAcctId]),
        safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2100'`),   // Accounts Payable
        safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1410'`),  // Input CGST
        safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1420'`),  // Input SGST
        safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1430'`),  // Input IGST
        bank_account_id ? safeQuery(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]) : Promise.resolve({ rows: [null] }),
      ]);
    if (!expenseAcct) return res.status(400).json({ error: 'expense_account_id does not match a chart_of_accounts row' });
    if (pay_immediately && !bank) return res.status(404).json({ error: 'Bank account not found' });

    const resolvedDueDate = due_date || bill_date;
    // bill_status enum has no 'pending' — 'received' is the correct not-yet-paid state
    // (purchaseRequests.js's convert-to-bill route uses 'pending' too, which is the
    // same bug — that insert will fail if it's ever hit; worth fixing there as well)
    const status = pay_immediately ? 'paid' : 'received';

    const bill = await withTransaction(async (client) => {
      const { rows: [{ next_num }] } = await client.query(
        `SELECT 'BILL-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                LPAD((COALESCE(MAX(SUBSTRING(bill_number FROM '\\d+$')::int), 0) + 1)::text, 6, '0') AS next_num
         FROM bills WHERE bill_number LIKE 'BILL-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
      );
      const { rows: [b] } = await client.query(
        `INSERT INTO bills (bill_number, vendor_id, bill_date, due_date, status, category_id,
           subtotal, gst_amount, total_amount, amount_paid, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [next_num, vendor_id, bill_date, resolvedDueDate, status, category_id || null,
         sub, round2(cgst + sgst + igst), totalAmount, pay_immediately ? totalAmount : 0,
         description || null, req.staff.id]
      );
      return b;
    });

    // Dr Expense, Dr Input GST (ITC) | Cr Bank (if paid now) or Cr Accounts Payable (if not)
    const lines = [{ accountId: expenseAcct.id, debit: sub, description: description || `Bill ${bill.bill_number}` }];
    if (cgst > 0) lines.push({ accountId: cgstAcct.id, debit: cgst, description: 'Input CGST (ITC)' });
    if (sgst > 0) lines.push({ accountId: sgstAcct.id, debit: sgst, description: 'Input SGST (ITC)' });
    if (igst > 0) lines.push({ accountId: igstAcct.id, debit: igst, description: 'Input IGST (ITC)' });
    lines.push(
      pay_immediately
        ? { accountId: bank.ledger_account_id, credit: totalAmount, description: `Payment for ${bill.bill_number}` }
        : { accountId: apAcct.id, credit: totalAmount, partyId: vendor_id, description: `Payable — ${bill.bill_number}` }
    );

    const je = await ledger.postJournalEntry({
      entryDate: bill_date, source: 'bill', sourceType: 'bill', sourceId: bill.id,
      narration: `Bill ${bill.bill_number} — ${vendor.name}`, createdBy: req.staff.id, lines,
    });

    await safeQuery(`UPDATE bills SET journal_entry_id = $1 WHERE id = $2`, [je.id, bill.id]);

    res.status(201).json({ bill: { ...bill, journal_entry_id: je.id } });
  } catch (err) {
    console.error('[bills:create]', err);
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// ── pay down a pending bill later (Dr Accounts Payable | Cr Bank) ───────────
router.post('/:id/pay', requireRole('finance'), async (req, res) => {
  try {
    const { bank_account_id, amount, payment_date } = req.body;
    if (!bank_account_id || !amount) return res.status(400).json({ error: 'bank_account_id and amount are required' });

    const { rows: [bill] } = await safeQuery(`SELECT * FROM bills WHERE id = $1`, [req.params.id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.status === 'paid') return res.status(409).json({ error: 'This bill is already fully paid' });

    const { rows: [bank] } = await safeQuery(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });
    const { rows: [apAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2100'`);

    const payAmount = round2(Number(amount));
    const remainingBefore = round2(Number(bill.total_amount) - Number(bill.amount_paid));
    if (payAmount > remainingBefore) return res.status(400).json({ error: `Amount exceeds remaining balance (${remainingBefore})` });

    const paidDate = payment_date || new Date().toISOString().slice(0, 10);
    const newPaid = round2(Number(bill.amount_paid) + payAmount);
    const newStatus = newPaid >= Number(bill.total_amount) ? 'paid' : 'partially_paid';

    await withTransaction(async (client) => {
      await client.query(`INSERT INTO payments_made (bill_id, payment_date, amount, bank_account_id, created_by) VALUES ($1,$2,$3,$4,$5)`,
        [bill.id, paidDate, payAmount, bank_account_id, req.staff.id]);
      await client.query(`UPDATE bills SET amount_paid = $1, status = $2 WHERE id = $3`, [newPaid, newStatus, bill.id]);
    });

    const je = await ledger.postJournalEntry({
      entryDate: paidDate, source: 'payment', sourceType: 'bill_payment', sourceId: bill.id,
      narration: `Payment for ${bill.bill_number}`, createdBy: req.staff.id,
      lines: [
        { accountId: apAcct.id, debit: payAmount, partyId: bill.vendor_id, description: `Payment — ${bill.bill_number}` },
        { accountId: bank.ledger_account_id, credit: payAmount, description: `Payment — ${bill.bill_number}` },
      ],
    });

    res.json({ status: newStatus, amountPaid: newPaid, journalEntryId: je.id });
  } catch (err) {
    console.error('[bills:pay]', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ── list bills (one-off + auto-generated from recurring/purchase-requests) ──
router.get('/', async (req, res) => {
  try {
    const { status, vendor_id } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }
    if (vendor_id) { params.push(vendor_id); conditions.push(`b.vendor_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const { rows } = await safeQuery(
      `SELECT b.*, p.name AS vendor_name, ec.name AS category_name
       FROM bills b
       LEFT JOIN parties p ON p.id = b.vendor_id
       LEFT JOIN expense_categories ec ON ec.id = b.category_id
       ${where}
       ORDER BY b.bill_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ bills: rows });
  } catch (err) {
    console.error('[bills:list]', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

module.exports = router;