'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');

router.use(authenticate);

const HOME_STATE = process.env.COMPANY_STATE || 'Maharashtra'; // set to your registered GST state

// ── create invoice ──────────────────────────────────────────────────────────
// GST logic: if the customer's state matches HOME_STATE -> CGST + SGST (split rate).
// Otherwise -> IGST (full rate). This is the standard India intra-state vs inter-state rule.
router.post('/', requireRole('finance'), async (req, res) => {
  try {
    const { party_id, invoice_date, due_date, items, notes } = req.body;
    if (!party_id || !invoice_date || !due_date || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'party_id, invoice_date, due_date, items[] are required' });
    }

    const { rows: [party] } = await safeQuery(`SELECT * FROM parties WHERE id = $1`, [party_id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const isInterState = party.state && party.state.trim().toLowerCase() !== HOME_STATE.trim().toLowerCase();

    let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const computedItems = items.map((it) => {
      const lineTotal = Number(it.quantity || 1) * Number(it.unit_price);
      const gstRate = Number(it.gst_rate ?? 18);
      const gstAmount = (lineTotal * gstRate) / 100;
      subtotal += lineTotal;
      if (isInterState) {
        igstTotal += gstAmount;
      } else {
        cgstTotal += gstAmount / 2;
        sgstTotal += gstAmount / 2;
      }
      return { ...it, lineTotal, gstRate };
    });

    const round2 = (n) => Math.round(n * 100) / 100;
    subtotal = round2(subtotal); cgstTotal = round2(cgstTotal); sgstTotal = round2(sgstTotal); igstTotal = round2(igstTotal);
    const totalAmount = round2(subtotal + cgstTotal + sgstTotal + igstTotal);

    // Revenue account: use each item's income_account_id if given, else default 'Services Revenue'
    const { rows: [defaultIncomeAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '4200'`);
    const { rows: [arAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1200'`); // Accounts Receivable
    const { rows: [cgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2210'`);
    const { rows: [sgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2220'`);
    const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2230'`);

    const result = await withTransaction(async (client) => {
      const { rows: [{ next_num }] } = await client.query(
        `SELECT 'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                LPAD((COALESCE(MAX(SUBSTRING(invoice_number FROM '\\d+$')::int), 0) + 1)::text, 6, '0') AS next_num
         FROM invoices WHERE invoice_number LIKE 'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
      );

      const { rows: [invoice] } = await client.query(
        `INSERT INTO invoices (invoice_number, party_id, invoice_date, due_date, status,
           subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, place_of_supply, notes, created_by)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [next_num, party_id, invoice_date, due_date, subtotal, cgstTotal, sgstTotal, igstTotal, totalAmount,
         party.state || null, notes || null, req.staff.id]
      );

      for (const it of computedItems) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, hsn_sac_code, quantity, unit_price, gst_rate, line_total, income_account_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [invoice.id, it.description, it.hsn_sac_code || null, it.quantity || 1, it.unit_price,
           it.gstRate, it.lineTotal, it.income_account_id || defaultIncomeAcct.id]
        );
      }
      return invoice;
    });

    // Post to the ledger: Dr Accounts Receivable | Cr Revenue, Cr GST payable accounts
    const lines = [
      { accountId: arAcct.id, debit: totalAmount, partyId: party_id, description: `Invoice ${result.invoice_number}` },
      { accountId: defaultIncomeAcct.id, credit: subtotal, description: `Revenue - ${result.invoice_number}` },
    ];
    if (cgstTotal > 0) lines.push({ accountId: cgstAcct.id, credit: cgstTotal, description: 'CGST output' });
    if (sgstTotal > 0) lines.push({ accountId: sgstAcct.id, credit: sgstTotal, description: 'SGST output' });
    if (igstTotal > 0) lines.push({ accountId: igstAcct.id, credit: igstTotal, description: 'IGST output' });

    const je = await ledger.postJournalEntry({
      entryDate: invoice_date, source: 'invoice', sourceType: 'invoice', sourceId: result.id,
      narration: `Invoice ${result.invoice_number} to ${party.name}`, createdBy: req.staff.id, lines,
    });

    await safeQuery(`UPDATE invoices SET journal_entry_id = $1, status = 'sent' WHERE id = $2`, [je.id, result.id]);

    res.status(201).json({ invoice: { ...result, journal_entry_id: je.id, status: 'sent' } });
  } catch (err) {
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
