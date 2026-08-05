'use strict';
/**
 * seed-incorporation-expenses.js
 *
 * Logs 6 real expenses (June/July 2026 incorporation costs + the May 2026
 * Hostinger domain purchase) into the ERP through the actual API — same
 * code path as clicking "New expense" in the UI, so GST, ledger posting,
 * and proof-attachment all happen exactly as they would through Finance.jsx.
 * Nothing here bypasses the real logic.
 *
 * SETUP:
 *   1. npm install axios form-data
 *   2. Put this file in the SAME folder as the receipt files (the
 *      incorporation-expense-receipts/ folder — keep that folder name and
 *      structure, or edit RECEIPT_DIR below).
 *   3. Vendors must already exist (Ministry of Corporate Affairs, eMudhra
 *      Limited, Damini Srivastava, Hostinger) — this script looks them up
 *      by name and will fail clearly if any are missing.
 *   4. Set env vars and run (PowerShell):
 *        $env:API_BASE_URL="http://localhost:3001"
 *        $env:STAFF_EMAIL="founder@ethertrack.in"
 *        $env:STAFF_PASSWORD="yourpassword"
 *        node seed-incorporation-expenses.js
 *
 * Safe to re-run: each bill's vendor + amount + date is checked against
 * existing bills before creating a duplicate.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL;
const STAFF_EMAIL = process.env.STAFF_EMAIL;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD;
const PAID_BY_NAME = process.env.PAID_BY_NAME || 'Varun Girish Deshmukh';
const RECEIPT_DIR = path.join(__dirname, 'incorporation-expense-receipts');

if (!API_BASE_URL || !STAFF_EMAIL || !STAFF_PASSWORD) {
  console.error('Set API_BASE_URL, STAFF_EMAIL, STAFF_PASSWORD env vars before running.');
  process.exit(1);
}

// ── the 6 expenses ───────────────────────────────────────────────────────────
const EXPENSES = [
  {
    vendorName: 'Ministry of Corporate Affairs',
    description: 'SPICe+ Part A fee (SRN AC4027807)',
    bill_date: '2026-06-17',
    subtotal: 1000,
    gst_rate: 0,
    receiptFile: 'AC4027807_Receipt_pdf.pdf',
  },
  {
    vendorName: 'Ministry of Corporate Affairs',
    description: 'SPICe+ Part B fee (SRN AC4513390)',
    bill_date: '2026-07-09',
    subtotal: 143,
    gst_rate: 0,
    receiptFile: 'AC4513390_Receipt_pdf.pdf',
  },
  {
    vendorName: 'Ministry of Corporate Affairs',
    description: 'Stamp duty — SPICe+ Part B (SRN EE0595805)',
    bill_date: '2026-07-09',
    subtotal: 1300,
    gst_rate: 0,
    receiptFile: 'EE0595805_Receipt_pdf.pdf',
  },
  {
    vendorName: 'eMudhra Limited',
    description: 'DSC Class 3 – 2 Year (Invoice 29RT260708844)',
    bill_date: '2026-07-17',
    subtotal: 1500,
    gst_rate: 18, // IGST — eMudhra is Karnataka, home state Maharashtra
    receiptFile: '29RT260708844.pdf',
  },
  {
    vendorName: 'Damini Srivastava',
    description: 'CA professional fee — incorporation',
    bill_date: '2026-07-24',
    subtotal: 8250,
    gst_rate: 0, // no GST invoice provided — adjust if she issues one later
    receiptFile: 'paytm_ca_fee_receipt.png',
  },
  {
    vendorName: 'Hostinger',
    description: '.IN Domain ethertrack.in — 3-year bundle (Invoice HSG-8294767, May 2026 to May 2029)',
    bill_date: '2026-05-31',
    subtotal: 1619.10,
    gst_rate: 18, // IGST — Hostinger PTE is Singapore, foreign OIDAR GST registration
    receiptFile: 'hostinger_domain_receipt.pdf',
  },
];

// Category resolution order: try the ideal fit first, fall back if it
// doesn't exist in your chart of accounts.
const CATEGORY_PREFERENCES = {
  'Ministry of Corporate Affairs': ['Legal & Professional'],
  'eMudhra Limited': ['Legal & Professional'],
  'Damini Srivastava': ['Legal & Professional'],
  'Hostinger': ['Software & SaaS Tools', 'Legal & Professional'],
};

async function main() {
  const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

  console.log('Logging in...');
  const loginRes = await api.post('/api/auth/login', { email: STAFF_EMAIL, password: STAFF_PASSWORD });
  if (loginRes.data?.requiresDeviceVerification || loginRes.data?.pending2fa) {
    console.error('Login requires 2FA/device verification — this script can\'t complete that interactively. Log in via the browser once on this device/IP first, or temporarily disable 2FA for this run.');
    process.exit(1);
  }
  if (loginRes.data?.token) {
    api.defaults.headers.common.Authorization = `Bearer ${loginRes.data.token}`;
  } else if (loginRes.headers['set-cookie']) {
    api.defaults.headers.common.Cookie = loginRes.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
  } else {
    console.error('Login succeeded but no token/cookie was returned — check routes/auth.js\'s actual response shape and adjust this script.');
    process.exit(1);
  }
  console.log('Logged in.');

  console.log('Looking up vendors...');
  const { data: { vendors } } = await api.get('/api/accounting/vendors');
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v]));

  console.log('Looking up expense categories...');
  const { data: { categories } } = await api.get('/api/accounting/expense-categories');
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  console.log('Checking for existing bills to avoid duplicates...');
  const { data: { bills: existingBills } } = await api.get('/api/finance/bills', { params: { limit: 200 } });

  for (const exp of EXPENSES) {
    const vendor = vendorByName[exp.vendorName];
    if (!vendor) {
      console.error(`✗ Vendor "${exp.vendorName}" not found — skipping "${exp.description}".`);
      continue;
    }

    const preferences = CATEGORY_PREFERENCES[exp.vendorName] || [];
    const category = preferences.map((name) => categoryByName[name]).find(Boolean);
    if (!category) {
      console.error(`✗ None of the preferred categories [${preferences.join(', ')}] exist — skipping "${exp.description}". Create one of these categories first.`);
      continue;
    }

    const alreadyExists = existingBills.some(
      (b) => b.vendor_id === vendor.id && b.bill_date?.slice(0, 10) === exp.bill_date && Number(b.subtotal) === exp.subtotal
    );
    if (alreadyExists) {
      console.log(`↷ Skipping "${exp.description}" — a matching bill already exists.`);
      continue;
    }

    const receiptPath = path.join(RECEIPT_DIR, exp.receiptFile);
    if (!fs.existsSync(receiptPath)) {
      console.error(`✗ Receipt file not found at ${receiptPath} — skipping "${exp.description}".`);
      continue;
    }

    console.log(`Creating bill: ${exp.description}...`);
    let billId;
    try {
      const { data } = await api.post('/api/finance/bills', {
        vendor_id: vendor.id,
        category_id: category.id,
        bill_date: exp.bill_date,
        description: exp.description,
        subtotal: exp.subtotal,
        gst_rate: exp.gst_rate,
        payment_method: 'director_loan',
        paid_by_name: PAID_BY_NAME,
      });
      billId = data.bill.id;
    } catch (err) {
      console.error(`✗ Failed to create bill for "${exp.description}":`, err.response?.data?.error || err.message);
      continue;
    }

    console.log(`  Uploading receipt (${exp.receiptFile})...`);
    try {
      const fd = new FormData();
      fd.append('file', fs.createReadStream(receiptPath));
      fd.append('title', `Receipt — ${exp.description}`);
      fd.append('doc_type', 'expense_receipt');
      fd.append('entity_type', 'bill');
      fd.append('entity_id', billId);
      const { data: docData } = await api.post('/api/documents', fd, { headers: fd.getHeaders() });

      await api.patch(`/api/finance/bills/${billId}/receipt`, { receipt_document_id: docData.document.id });
      console.log(`✓ Seeded "${exp.description}" — bill ${billId}, proof attached.`);
    } catch (err) {
      console.error(`✗ Proof attach failed for "${exp.description}" — deleting the bill so nothing is left without proof:`, err.response?.data?.error || err.message);
      await api.delete(`/api/finance/bills/${billId}`).catch(() => {});
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err.response?.data || err.message);
  process.exit(1);
});