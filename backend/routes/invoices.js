'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');
const { createInvoice } = require('../services/invoicing');

router.use(authenticate);

const HOME_STATE = process.env.COMPANY_STATE || 'Maharashtra'; // set to your registered GST state

// ── create invoice ──────────────────────────────────────────────────────────
// GST logic: if the customer's state matches HOME_STATE -> CGST + SGST (split rate).
// Otherwise -> IGST (full rate). This is the standard India intra-state vs inter-state rule.
// [REFACTOR] The actual GST computation + ledger posting now lives in
// services/invoicing.js — extracted so services/corporateDeals.js can
// generate one invoice per billing period without duplicating this logic.
// Behavior here is unchanged.
router.post('/', requireRole('finance'), async (req, res) => {
  try {
    const { party_id, invoice_date, due_date, items, notes } = req.body;
    const invoice = await createInvoice({ party_id, invoice_date, due_date, items, notes, createdBy: req.staff.id });
    res.status(201).json({ invoice });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[invoices:create]', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, party_id } = req.query;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
    if (party_id) { params.push(party_id); conditions.push(`i.party_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT i.*, p.name AS party_name FROM invoices i JOIN parties p ON p.id = i.party_id ${where} ORDER BY i.invoice_date DESC`,
      params
    );
    res.json({ invoices: rows });
  } catch (err) {
    console.error('[invoices:list]', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [invoice] } = await safeQuery(
      `SELECT i.*, p.name AS party_name, p.gstin, p.billing_address FROM invoices i JOIN parties p ON p.id = i.party_id WHERE i.id = $1`,
      [req.params.id]
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const { rows: items } = await safeQuery(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [req.params.id]);
    res.json({ invoice, items });
  } catch (err) {
    console.error('[invoices:get]', err);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// ── record a payment against an invoice ─────────────────────────────────────
router.post('/:id/payments', requireRole('finance'), async (req, res) => {
  try {
    const { amount, payment_date, method, reference, bank_account_id } = req.body;
    if (!amount || !payment_date || !bank_account_id) {
      return res.status(400).json({ error: 'amount, payment_date, bank_account_id are required' });
    }
    const { rows: [invoice] } = await safeQuery(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { rows: [bank] } = await safeQuery(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
    const { rows: [arAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);

    const je = await ledger.postJournalEntry({
      entryDate: payment_date, source: 'payment', sourceType: 'invoice_payment', sourceId: invoice.id,
      narration: `Payment received for ${invoice.invoice_number}`, createdBy: req.staff.id,
      lines: [
        { accountId: bank.ledger_account_id, debit: amount, description: 'Payment received' },
        { accountId: arAcct.id, credit: amount, partyId: invoice.party_id, description: `Against ${invoice.invoice_number}` },
      ],
    });

    const { rows: [payment] } = await safeQuery(
      `INSERT INTO payments_received (invoice_id, amount, payment_date, method, reference, bank_account_id, journal_entry_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [invoice.id, amount, payment_date, method || null, reference || null, bank_account_id, je.id, req.staff.id]
    );

    const newPaid = Number(invoice.amount_paid) + Number(amount);
    const newStatus = newPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';
    await safeQuery(`UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3`, [newPaid, newStatus, invoice.id]);

    res.status(201).json({ payment, invoiceStatus: newStatus });
  } catch (err) {
    console.error('[invoices:payment]', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;