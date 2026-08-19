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
router.post('/', requireRole('finance'), async (req, res) => {
  try {
    const { party_id, invoice_date, due_date, items, notes, invoice_type } = req.body;
    const invoice = await createInvoice({ party_id, invoice_date, due_date, items, notes, createdBy: req.staff.id, invoice_type });
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
    const { amount, payment_date, method, reference, bank_account_id, idempotency_key } = req.body;
    if (!amount || !payment_date || !bank_account_id) {
      return res.status(400).json({ error: 'amount, payment_date, bank_account_id are required' });
    }

    // Idempotency check
    if (idempotency_key) {
      const { rows: [existing] } = await safeQuery(
        `SELECT id FROM payments_received WHERE idempotency_key = $1`,
        [idempotency_key]
      );
      if (existing) {
        return res.status(409).json({ error: 'Payment with this idempotency key already exists', paymentId: existing.id });
      }
    }

    // Use transaction for atomicity
    const result = await withTransaction(async (client) => {
      // Lock the invoice row to prevent concurrent payments
      const { rows: [invoice] } = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!invoice) throw new Error('Invoice not found');

      // Check for overpayment
      const newPaid = Number(invoice.amount_paid) + Number(amount);
      if (newPaid > Number(invoice.total_amount)) {
        throw new Error(`Payment amount exceeds remaining balance (${Number(invoice.total_amount) - Number(invoice.amount_paid)})`);
      }

      const { rows: [bank] } = await client.query(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
      if (!bank) throw new Error('Bank account not found');
      const { rows: [arAcct] } = await client.query(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
      if (!arAcct) throw new Error('AR account (1200) not found in chart of accounts');

      const payment_date_clean = payment_date;
      const method = method || null;
      const reference = reference || null;

      // Post journal entry
      const je = await ledger.postJournalEntry({
        entryDate: payment_date_clean, source: 'payment', sourceType: 'invoice_payment', sourceId: invoice.id,
        narration: `Payment received for ${invoice.invoice_number}`, createdBy: req.staff.id,
        lines: [
          { accountId: bank.ledger_account_id, debit: amount, description: 'Payment received' },
          { accountId: arAcct.id, credit: amount, partyId: invoice.party_id, description: `Against ${invoice.invoice_number}` },
        ],
      }, client);

      // Insert payment record
      const { rows: [payment] } = await client.query(
        `INSERT INTO payments_received (invoice_id, amount, payment_date, method, reference, bank_account_id, journal_entry_id, created_by, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [invoice.id, amount, payment_date_clean, method, reference, bank_account_id, je.id, req.staff.id, idempotency_key || null]
      );

      // Update invoice
      const newStatus = newPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';
      await client.query(`UPDATE invoices SET amount_paid = $1, status = $2 WHERE id = $3`, [newPaid, newStatus, invoice.id]);

      return { payment, invoiceStatus: newStatus, journalEntry: je };
    });

    // Handle corporate deal access extension (non-fatal)
    let corporateAccessExtension = null;
    // [AUTO-SUSPEND] If this invoice is a Corporate deal installment and is
    // now fully paid, extend the platform account's access to cover the next
    // period + grace. No-ops for regular (non-deal) invoices and for
    // one_time deals — see services/corporateDeals.js's
    // extendAccessForPaidInstallment() header comment for the full picture.
    // Non-fatal: a failure here shouldn't undo an already-recorded payment.
    if (newStatus === 'paid') {
      try {
        const { extendAccessForPaidInstallment } = require('../services/corporateDeals');
        corporateAccessExtension = await extendAccessForPaidInstallment(invoice.id);
      } catch (e) {
        console.warn('[invoices:payment] corporate deal access extension failed (payment still recorded):', e.message);
      }
    }

    res.status(201).json({ payment, invoiceStatus: newStatus, corporateAccessExtension });
  } catch (err) {
    console.error('[invoices:payment]', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;