/**
 * Financial Correctness Tests
 * Tests atomicity, idempotency, concurrency, and closed-period enforcement
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-testing-only';
const DB_URL = process.env.TEST_DB_URL || process.env.INTERNAL_OPS_DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m' });
}

async function createTestApp(pool) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Mock authenticate middleware
  app.use((req, res, next) => {
    const token = req.cookies?.internal_ops_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.staff = { id: decoded.sub, role: decoded.role, employee_id: decoded.employee_id };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Mock withTransaction
  async function withTransaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Mock ledger.postJournalEntry
  async function postJournalEntry(entry, client) {
    const { entryDate, source, sourceType, sourceId, narration, createdBy, lines } = entry;
    
    let totalDebit = 0, totalCredit = 0;
    for (const l of lines) {
      totalDebit += Number(l.debit || 0);
      totalCredit += Number(l.credit || 0);
    }
    if (Math.round(totalDebit * 100) / 100 !== Math.round(totalCredit * 100) / 100) {
      throw new Error('Journal entry does not balance');
    }

    const entryNumber = `JE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
    const { rows: [je] } = await client.query(
      `INSERT INTO journal_entries (entry_number, entry_date, source, source_type, source_id, narration, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, entry_number`,
      [entryNumber, entryDate, source, sourceType || null, sourceId || null, narration || null, createdBy || null]
    );

    for (const l of lines) {
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, party_id, description)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [je.id, l.accountId, l.debit || 0, l.credit || 0, l.partyId || null, l.description || null]
      );
    }
    return { id: je.id, entryNumber: je.entry_number };
  }

  // Test routes
  app.post('/api/test/invoice-payment', async (req, res) => {
    try {
      const { invoice_id, amount, payment_date, bank_account_id, idempotency_key } = req.body;
      
      // Idempotency check
      if (idempotency_key) {
        const { rows: [existing] } = await pool.query(
          `SELECT id FROM payments_received WHERE idempotency_key = $1`,
          [idempotency_key]
        );
        if (existing) return res.status(409).json({ error: 'Duplicate idempotency key' });
      }

      const result = await withTransaction(async (client) => {
        const { rows: [invoice] } = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [invoice_id]);
        if (!invoice) throw new Error('Invoice not found');
        
        const newPaid = Number(invoice.amount_paid) + Number(amount);
        if (newPaid > Number(invoice.total_amount)) {
          throw new Error('Overpayment');
        }

        const { rows: [bank] } = await client.query(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
        const { rows: [arAcct] } = await client.query(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
        if (!bank) throw new Error('Bank account not found');
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

return { payment, invoiceStatus: newStatus, journalEntry: je };
      });

      // Handle corporate deal access extension (non-fatal)
      let corporateAccessExtension = null;
      if (result.invoiceStatus === 'paid') {
        try {
          const { extendAccessForPaidInstallment } = require('../services/corporateDeals');
          corporateAccessExtension = await extendAccessForPaidInstallment(req.params.id);
        } catch (e) {
          console.warn('[invoices:payment] corporate deal access extension failed (payment still recorded):', e.message);
        }
      }

      res.status(201).json({ payment: result.payment, invoiceStatus: result.invoiceStatus, corporateAccessExtension, journalEntry: result.journalEntry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/test/bill-payment', async (req, res) => {
    try {
      const { bank_account_id, amount, payment_date, idempotency_key } = req.body;
      if (!bank_account_id || !amount) return res.status(400).json({ error: 'bank_account_id and amount are required' });

      // Idempotency check
      if (idempotency_key) {
        const { rows: [existing] } = await pool.query(
          `SELECT id FROM payments_made WHERE idempotency_key = $1`,
          [idempotency_key]
        );
        if (existing) {
          return res.status(409).json({ error: 'Payment with this idempotency key already exists', paymentId: existing.id });
        }
      }

      // Use transaction for atomicity
      const result = await withTransaction(async (client) => {
        // Lock the bill row to prevent concurrent payments
        const { rows: [bill] } = await client.query(`SELECT * FROM bills WHERE id = $1 FOR UPDATE`, [req.params.id]);
        if (!bill) throw new Error('Bill not found');
        if (bill.status === 'paid') throw new Error('This bill is already fully paid');

        const { rows: [bank] } = await client.query(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
        if (!bank) throw new Error('Bank account not found');
        const { rows: [apAcct] } = await client.query(`SELECT id FROM chart_of_accounts WHERE code = '2100'`);
        if (!apAcct) throw new Error('AP account (2100) not found in chart of accounts');

        const payAmount = Math.round(Number(amount) * 100) / 100;
        const remainingBefore = Math.round(Number(bill.total_amount) - Number(bill.amount_paid));
        if (payAmount > remainingBefore) throw new Error(`Amount exceeds remaining balance (${remainingBefore})`);

        const paidDate = payment_date || new Date().toISOString().slice(0, 10);
        const newPaid = Math.round((Number(bill.amount_paid) + payAmount) * 100) / 100;
        const newStatus = newPaid >= Number(bill.total_amount) ? 'paid' : 'partially_paid';

        await client.query(`INSERT INTO payments_made (bill_id, payment_date, amount, bank_account_id, created_by, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6)`,
          [bill.id, paidDate, payAmount, bank_account_id, req.staff.id, idempotency_key || null]);
        await client.query(`UPDATE bills SET amount_paid = $1, status = $2 WHERE id = $3`, [newPaid, newStatus, bill.id]);

        // Post journal entry inside the transaction
        const je = await ledger.postJournalEntry({
          entryDate: paidDate, source: 'payment', sourceType: 'bill_payment', sourceId: bill.id,
          narration: `Payment for ${bill.bill_number}`, createdBy: req.staff.id,
          lines: [
            { accountId: apAcct.id, debit: payAmount, partyId: bill.vendor_id, description: `Payment — ${bill.bill_number}` },
            { accountId: bank.ledger_account_id, credit: payAmount, description: `Payment — ${bill.bill_number}` },
          ],
        }, client);

        return { status: newStatus, amountPaid: newPaid, journalEntryId: je.id };
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to record payment' });
    }
  });

  // Closed period test endpoint
  app.post('/api/test/closed-period', async (req, res) => {
    try {
      // Try to insert a journal entry in a closed period
      const { rows: [period] } = await pool.query(
        `SELECT * FROM fiscal_periods WHERE is_closed = true LIMIT 1`
      );
      
      if (!period) {
        return res.status(400).json({ error: 'No closed period for testing' });
      }

      const { rows: [acct] } = await pool.query(`SELECT id FROM chart_of_accounts LIMIT 2`);
      if (acct.length < 2) return res.status(400).json({ error: 'Need 2 accounts' });

      await postJournalEntry({
        entryDate: period.start_date,
        source: 'manual',
        narration: 'Test closed period',
        createdBy: 'finance-1',
        lines: [
          { accountId: acct[0].id, debit: 100 },
          { accountId: acct[1].id, credit: 100 },
        ],
      });

      res.status(400).json({ error: 'Should have thrown closed period error' });
    } catch (err) {
      if (err.message.includes('closed')) {
        res.json({ ok: true, message: 'Correctly blocked closed period entry' });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  return app;
}

function createToken(role = 'finance', userId = 'finance-1') {
  return signAccessToken({ sub: userId, role });
}

async function runFinancialTests() {
  const pool = new Pool({ connectionString: DB_URL });
  const app = await createTestApp(pool);
  const results = { passed: 0, failed: 0, tests: [] };

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function test(name, fn) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`  �� ${name}`);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.log(`  ��� ${name}: ${err.message}`);
    }
  }

  console.log('\n=== FINANCIAL CORRECTNESS TESTS ===\n');

  // Test 1: Invoice payment atomicity
  await test('Invoice payment is atomic (journal + payment + invoice update)', async () => {
    // Setup test data
    const { rows: [party] } = await pool.query(
      `INSERT INTO parties (name, party_type, state) VALUES ('Test Customer', 'customer', 'Maharashtra') RETURNING *`
    );
    const { rows: [arAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
    const { rows: [bankAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1100'`);
    const { rows: [bank] } = await pool.query(
      `INSERT INTO bank_accounts (account_name, account_number, ifsc, bank_name, ledger_account_id) 
       VALUES ('Test Bank', '12345', 'ABC0001', 'Test Bank', $1) RETURNING *`,
      [bankAcct.id]
    );

    const { rows: [invoice] } = await pool.query(
      `INSERT INTO invoices (invoice_number, party_id, invoice_date, due_date, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, amount_paid, status, place_of_supply, created_by)
       VALUES ('INV-TEST-001', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 1000, 90, 90, 0, 1180, 0, 'sent', 'Maharashtra', 'finance-1') RETURNING *`,
      [party.id]
    );

    const token = createToken('finance', 'finance-1');
    const idempotencyKey = `test-payment-${Date.now()}`;

    const res = await request(app)
      .post('/api/test/invoice-payment')
      .set('Cookie', [`internal_ops_token=${token}`])
      .send({
        invoice_id: invoice.id,
        amount: 500,
        payment_date: new Date().toISOString().slice(0, 10),
        bank_account_id: bank.id,
        idempotency_key: idempotencyKey
      });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.payment.amount === 500, 'Payment amount mismatch');
    assert(res.body.invoiceStatus === 'partially_paid', 'Invoice status should be partially_paid');

    // Verify journal entry balances
    const { rows: [je] } = await pool.query(
      `SELECT * FROM journal_entries WHERE id = (SELECT journal_entry_id FROM payments_received WHERE invoice_id = $1)`,
      [invoice.id]
    );
    const { rows: lines } = await pool.query(
      `SELECT * FROM journal_lines WHERE journal_entry_id = $1`,
      [je.id]
    );
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
    assert(Math.round(totalDebit * 100) / 100 === Math.round(totalCredit * 100) / 100, 'Journal entry must balance');

    // Verify invoice amount_paid updated
    const { rows: [updatedInvoice] } = await pool.query(`SELECT amount_paid FROM invoices WHERE id = $1`, [invoice.id]);
    assert(Number(updatedInvoice.amount_paid) === 500, 'Invoice amount_paid should be 500');
  });

  // Test 2: Idempotency - duplicate payment rejected
  await test('Invoice payment idempotency key prevents duplicate', async () => {
    const { rows: [party] } = await pool.query(
      `INSERT INTO parties (name, party_type, state) VALUES ('Test Customer 2', 'customer', 'Maharashtra') RETURNING *`
    );
    const { rows: [arAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
    const { rows: [bankAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1100'`);
    const { rows: [bank] } = await pool.query(
      `INSERT INTO bank_accounts (account_name, account_number, ifsc, bank_name, ledger_account_id) 
       VALUES ('Test Bank 2', '12346', 'ABC0002', 'Test Bank', $1) RETURNING *`,
      [bankAcct.id]
    );

    const { rows: [invoice] } = await pool.query(
      `INSERT INTO invoices (invoice_number, party_id, invoice_date, due_date, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, amount_paid, status, place_of_supply, created_by)
       VALUES ('INV-TEST-002', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 2000, 180, 180, 0, 2360, 0, 'sent', 'Maharashtra', 'finance-1') RETURNING *`,
      [party.id]
    );

    const token = createToken('finance', 'finance-1');
    const idempotencyKey = `test-idempotent-${Date.now()}`;

    // First payment
    const res1 = await request(app)
      .post('/api/test/invoice-payment')
      .set('Cookie', [`internal_ops_token=${token}`])
      .send({
        invoice_id: invoice.id,
        amount: 1000,
        payment_date: new Date().toISOString().slice(0, 10),
        bank_account_id: bank.id,
        idempotency_key: idempotencyKey
      });
    assert(res1.status === 201, `First payment failed: ${res1.status}`);

    // Second payment with same idempotency key
    const res2 = await request(app)
      .post('/api/test/invoice-payment')
      .set('Cookie', [`internal_ops_token=${token}`])
      .send({
        invoice_id: invoice.id,
        amount: 1000,
        payment_date: new Date().toISOString().slice(0, 10),
        bank_account_id: bank.id,
        idempotency_key: idempotencyKey
      });
    assert(res2.status === 409, `Expected 409 for duplicate, got ${res2.status}`);
    assert(res2.body.error.includes('idempotency'), `Error should mention idempotency: ${res2.body.error}`);
  });

  // Test 3: Bill payment atomicity
  await test('Bill payment is atomic (journal + payment + bill update)', async () => {
    const { rows: [vendor] } = await pool.query(
      `INSERT INTO parties (name, party_type, state) VALUES ('Test Vendor', 'vendor', 'Maharashtra') RETURNING *`
    );
    const { rows: [cat] } = await pool.query(
      `INSERT INTO expense_categories (name, expense_account_id) VALUES ('Test Category', (SELECT id FROM chart_of_accounts WHERE code = '5300')) RETURNING *`
    );
    const { rows: [bankAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1100'`);
    const { rows: [bank] } = await pool.query(
      `INSERT INTO bank_accounts (account_name, account_number, ifsc, bank_name, ledger_account_id) 
       VALUES ('Test Bank 3', '12347', 'ABC0003', 'Test Bank', $1) RETURNING *`,
      [bankAcct.id]
    );

    const { rows: [bill] } = await pool.query(
      `INSERT INTO bills (bill_number, vendor_id, bill_date, due_date, status, category_id, subtotal, gst_amount, total_amount, amount_paid, created_by)
       VALUES ('BILL-TEST-001', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'received', $2, 1000, 180, 1180, 0, 'finance-1') RETURNING *`,
      [vendor.id, cat.id]
    );

    const token = createToken('finance', 'finance-1');
    const idempotencyKey = `test-bill-payment-${Date.now()}`;

    const res = await request(app)
      .post('/api/test/bill-payment')
      .set('Cookie', [`internal_ops_token=${token}`])
      .send({
        bill_id: bill.id,
        amount: 500,
        payment_date: new Date().toISOString().slice(0, 10),
        bank_account_id: bank.id,
        idempotency_key: idempotencyKey
      });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === 'partially_paid', 'Bill status should be partially_paid');
    assert(res.body.amountPaid === 500, 'Bill amount_paid should be 500');

    // Verify journal entry balances
    const { rows: [je] } = await pool.query(
      `SELECT * FROM journal_entries WHERE id = (SELECT journal_entry_id FROM payments_made WHERE bill_id = $1)`,
      [bill.id]
    );
    const { rows: lines } = await pool.query(
      `SELECT * FROM journal_lines WHERE journal_entry_id = $1`,
      [je.id]
    );
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
    assert(Math.round(totalDebit * 100) / 100 === Math.round(totalCredit * 100) / 100, 'Journal entry must balance');

    // Verify bill amount_paid updated
    const { rows: [updatedBill] } = await pool.query(`SELECT amount_paid FROM bills WHERE id = $1`, [bill.id]);
    assert(Number(updatedBill.amount_paid) === 500, 'Bill amount_paid should be 500');
  });

  // Test 4: Closed fiscal period enforcement
  await test('Closed fiscal period blocks journal entry', async () => {
    // First create a closed period for testing
    const { rows: [period] } = await pool.query(
      `INSERT INTO fiscal_periods (label, start_date, end_date, is_closed, closed_at, closed_by)
       VALUES ('TEST-CLOSED', '2020-01-01', '2020-12-31', true, NOW(), 'finance-1') RETURNING *`
    );

    const { rows: [acct1] } = await pool.query(`SELECT id FROM chart_of_accounts LIMIT 1`);
    const { rows: [acct2] } = await pool.query(`SELECT id FROM chart_of_accounts LIMIT 1 OFFSET 1`);

    const token = createToken('finance', 'finance-1');
    const res = await request(app)
      .post('/api/test/closed-period')
      .set('Cookie', [`internal_ops_token=${token}`]);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.ok === true, 'Should have blocked closed period entry');

    // Cleanup
    await pool.query(`DELETE FROM fiscal_periods WHERE id = $1`, [period.id]);
  });

  // Test 5: Overpayment prevention
  await test('Invoice payment rejects overpayment', async () => {
    const { rows: [party] } = await pool.query(
      `INSERT INTO parties (name, party_type, state) VALUES ('Test Customer 3', 'customer', 'Maharashtra') RETURNING *`
    );
    const { rows: [arAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
    const { rows: [bankAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1100'`);
    const { rows: [bank] } = await pool.query(
      `INSERT INTO bank_accounts (account_name, account_number, ifsc, bank_name, ledger_account_id) 
       VALUES ('Test Bank 4', '12348', 'ABC0004', 'Test Bank', $1) RETURNING *`,
      [bankAcct.id]
    );

    const { rows: [invoice] } = await pool.query(
      `INSERT INTO invoices (invoice_number, party_id, invoice_date, due_date, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, amount_paid, status, place_of_supply, created_by)
       VALUES ('INV-TEST-003', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 1000, 90, 90, 0, 1180, 0, 'sent', 'Maharashtra', 'finance-1') RETURNING *`,
      [party.id]
    );

    const token = createToken('finance', 'finance-1');
    const res = await request(app)
      .post('/api/test/invoice-payment')
      .set('Cookie', [`internal_ops_token=${token}`])
      .send({
        invoice_id: invoice.id,
        amount: 2000, // Exceeds total_amount of 1180
        payment_date: new Date().toISOString().slice(0, 10),
        bank_account_id: bank.id
      });

    assert(res.status === 400 || res.status === 500, `Expected error for overpayment, got ${res.status}`);
  });

  // Test 6: Concurrent payment handling (simulated)
  await test('Concurrent payments handled with row locking', async () => {
    const { rows: [party] } = await pool.query(
      `INSERT INTO parties (name, party_type, state) VALUES ('Test Customer 4', 'customer', 'Maharashtra') RETURNING *`
    );
    const { rows: [arAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
    const { rows: [bankAcct] } = await pool.query(`SELECT id FROM chart_of_accounts WHERE code = '1100'`);
    const { rows: [bank] } = await pool.query(
      `INSERT INTO bank_accounts (account_name, account_number, ifsc, bank_name, ledger_account_id) 
       VALUES ('Test Bank 5', '12349', 'ABC0005', 'Test Bank', $1) RETURNING *`,
      [bankAcct.id]
    );

    const { rows: [invoice] } = await pool.query(
      `INSERT INTO invoices (invoice_number, party_id, invoice_date, due_date, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, amount_paid, status, place_of_supply, created_by)
       VALUES ('INV-TEST-004', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 1000, 90, 90, 0, 1180, 0, 'sent', 'Maharashtra', 'finance-1') RETURNING *`,
      [party.id]
    );

    const token = createToken('finance', 'finance-1');
    const idempotencyKey1 = `concurrent-${Date.now()}-1`;
    const idempotencyKey2 = `concurrent-${Date.now()}-2`;

    // Simulate concurrent payments by making two rapid requests
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/test/invoice-payment')
        .set('Cookie', [`internal_ops_token=${token}`])
        .send({
          invoice_id: invoice.id,
          amount: 500,
          payment_date: new Date().toISOString().slice(0, 10),
          bank_account_id: bank.id,
          idempotency_key: idempotencyKey1
        }),
      request(app)
        .post('/api/test/invoice-payment')
        .set('Cookie', [`internal_ops_token=${token}`])
        .send({
          invoice_id: invoice.id,
          amount: 500,
          payment_date: new Date().toISOString().slice(0, 10),
          bank_account_id: bank.id,
          idempotency_key: idempotencyKey2
        })
    ]);

    // Both should succeed (different idempotency keys, different amounts)
    // Total paid should be 1000
    const { rows: [updatedInvoice] } = await pool.query(`SELECT amount_paid FROM invoices WHERE id = $1`, [invoice.id]);
    assert(Number(updatedInvoice.amount_paid) === 1000, `Expected 1000 paid, got ${updatedInvoice.amount_paid}`);
  });

  // Summary
  console.log('\n=== FINANCIAL CORRECTNESS TEST SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);

  await pool.end();

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nAll financial correctness tests passed!');
  }
}

runFinancialTests().catch(console.error);