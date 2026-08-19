'use strict';
// services/invoicing.js
//
// Extracted out of routes/invoices.js's POST / handler so the exact same
// GST-computation + ledger-posting logic can be called from a service
// (services/corporateDeals.js, generating one invoice per billing period
// for a Corporate deal) as well as the existing manual "create invoice"
// route. Now supports subscription invoices with deferred revenue recognition.

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('./ledger');
const { createRevenueRecognitionSchedule } = require('./accrualService');

const HOME_STATE = process.env.COMPANY_STATE || 'Maharashtra';

const round2 = (n) => Math.round(n * 100) / 100;

// createInvoice({ party_id, invoice_date, due_date, items, notes, createdBy, invoice_type })
// invoice_type: 'one_time' (default) | 'subscription'
// items: [{ description, hsn_sac_code?, quantity?, unit_price, gst_rate?, income_account_id? }]
async function createInvoice({ party_id, invoice_date, due_date, items, notes, createdBy, invoice_type = 'one_time' }) {
  if (!party_id || !invoice_date || !due_date || !Array.isArray(items) || !items.length) {
    throw Object.assign(new Error('party_id, invoice_date, due_date, items[] are required'), { status: 400 });
  }

  const { rows: [party] } = await safeQuery(`SELECT * FROM parties WHERE id = $1`, [party_id]);
  if (!party) throw Object.assign(new Error('Party not found'), { status: 404 });

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

  subtotal = round2(subtotal); cgstTotal = round2(cgstTotal); sgstTotal = round2(sgstTotal); igstTotal = round2(igstTotal);
  const totalAmount = round2(subtotal + cgstTotal + sgstTotal + igstTotal);

  const { rows: [defaultIncomeAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '4200'`);
  const { rows: [arAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
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
         subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, place_of_supply, notes, created_by, invoice_type)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [next_num, party_id, invoice_date, due_date, subtotal, cgstTotal, sgstTotal, igstTotal, totalAmount,
       party.state || null, notes || null, createdBy, invoice_type]
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

  // For subscription invoices, use deferred revenue recognition
  if (invoice_type === 'subscription') {
    const accrualResult = await createRevenueRecognitionSchedule(result.id, createdBy);
    if (accrualResult) {
      return { ...result, journal_entry_id: accrualResult.journalEntry.id, status: 'sent', deferredRevenue: true };
    }
  }

  // Standard one-time invoice: post to income directly
  const lines = [
    { accountId: arAcct.id, debit: totalAmount, partyId: party_id, description: `Invoice ${result.invoice_number}` },
    { accountId: defaultIncomeAcct.id, credit: subtotal, description: `Revenue - ${result.invoice_number}` },
  ];
  if (cgstTotal > 0) lines.push({ accountId: cgstAcct.id, credit: cgstTotal, description: 'CGST output' });
  if (sgstTotal > 0) lines.push({ accountId: sgstAcct.id, credit: sgstTotal, description: 'SGST output' });
  if (igstTotal > 0) lines.push({ accountId: igstAcct.id, credit: igstTotal, description: 'IGST output' });

  const je = await ledger.postJournalEntry({
    entryDate: invoice_date, source: 'invoice', sourceType: 'invoice', sourceId: result.id,
    narration: `Invoice ${result.invoice_number} to ${party.name}`, createdBy, lines,
  });

  await safeQuery(`UPDATE invoices SET journal_entry_id = $1, status = 'sent' WHERE id = $2`, [je.id, result.id]);

  return { ...result, journal_entry_id: je.id, status: 'sent' };
}

module.exports = { createInvoice };