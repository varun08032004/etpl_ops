'use strict';
/**
 * cleanup-duplicate-bills.js
 *
 * One-time cleanup: deletes the 5 duplicate bills created when the seed
 * script's run got repeated. Run 003_bill_receipts.sql's UPDATE (clearing
 * receipt_document_id on these 5) BEFORE running this — the delete endpoint
 * refuses to delete a bill that still has proof attached, by design.
 *
 * Uses the same login flow as seed-incorporation-expenses.js. Put this in
 * the same folder and run the same way:
 *   $env:API_BASE_URL="http://localhost:3001"
 *   $env:STAFF_EMAIL="founder@ethertrack.in"
 *   $env:STAFF_PASSWORD="admin1234"
 *   node cleanup-duplicate-bills.js
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL;
const STAFF_EMAIL = process.env.STAFF_EMAIL;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD;

if (!API_BASE_URL || !STAFF_EMAIL || !STAFF_PASSWORD) {
  console.error('Set API_BASE_URL, STAFF_EMAIL, STAFF_PASSWORD env vars before running.');
  process.exit(1);
}

// The 5 duplicate bill ids to remove — the SECOND copy of each pair
// (confirmed via created_at timestamps: these are the 06:20 batch).
const DUPLICATE_BILL_IDS = [
  '71286001-29b7-42f2-a6fa-bf188e8e11ef', // MCA ₹1000 duplicate (BILL-2026-000006)
  'fb8880cb-c6db-42e0-af5d-b9d1460a0123', // MCA ₹143 duplicate (BILL-2026-000007)
  'ca0f08d7-6bf9-4665-962d-a2d818e4bf5c', // MCA ₹1300 duplicate (BILL-2026-000008)
  'f21c5748-bbc5-4c89-892a-dba58cda5234', // Damini ₹8250 duplicate (BILL-2026-000010)
  'cc724e34-82fa-43ef-8c75-eaeccbdb5773', // Hostinger ₹1910.54 duplicate (BILL-2026-000011)
];

async function main() {
  const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

  console.log('Logging in...');
  const loginRes = await api.post('/api/auth/login', { email: STAFF_EMAIL, password: STAFF_PASSWORD });
  if (loginRes.data?.token) {
    api.defaults.headers.common.Authorization = `Bearer ${loginRes.data.token}`;
  } else if (loginRes.headers['set-cookie']) {
    api.defaults.headers.common.Cookie = loginRes.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
  } else {
    console.error('Login succeeded but no token/cookie was returned.');
    process.exit(1);
  }
  console.log('Logged in.');

  for (const billId of DUPLICATE_BILL_IDS) {
    try {
      await api.delete(`/api/finance/bills/${billId}`);
      console.log(`✓ Deleted and reversed duplicate bill ${billId}`);
    } catch (err) {
      console.error(`✗ Failed to delete ${billId}:`, err.response?.data?.error || err.message);
      console.error('  If this says "proof attached", the receipt_document_id UPDATE in step 1 didn\'t run against this row — check it in SQL before retrying.');
    }
  }

  console.log('Done. Re-run the 2150 balance query to confirm it now reads ₹14,373.54.');
}

main().catch((err) => {
  console.error('Fatal error:', err.response?.data || err.message);
  process.exit(1);
});