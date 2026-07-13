'use strict';
// routes/platform-sync.js
//
// Pulls subscription + trade-fee revenue from the EtherTrack customer
// platform (read-only, via services/platformClient.js) and posts it into
// this ledger as journal entries — one click, scoped to a month/year.
//
// Idempotent: each platform record's (source, ref_id) is checked against
// platform_sync_log before posting, so re-running the same month (or a
// month whose range overlaps a previous sync) never double-posts. A DB
// UNIQUE constraint on platform_sync_log backs this up even under races.
//
// Every posted entry:
//   Dr  1120 Platform Settlement Account         total amount
//   Cr  4100 Subscription Revenue  (or 4110 Trade Fee Revenue)   amount - gst
//   Cr  2210 Output CGST / 2220 Output SGST / 2230 Output IGST   as applicable
//
// GST is booked as output tax payable because it was already collected by
// the platform on the company's behalf — it isn't fresh revenue, it's a
// liability owed to the government, same as any other invoice.
//
// VOIDING A MISTAKEN IMPORT: never delete a platform_sync_log row or its
// journal entry — that breaks the audit trail and can conflict with a
// filed GST return. Instead, POST /records/:logId/void posts a reversing
// journal entry via ledger.reverseJournalEntry(), which zeroes out the
// financial effect while leaving both the original and the reversal
// visible in the books, each dated and attributed. "Voided" is derived by
// checking journal_entries.reversed_by — no separate flag/column needed.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const ledger = require('../services/ledger');
const { fetchPlatformIncome, fetchPlatformCustomers, fetchInvoicePdf } = require('../services/platformClient');

router.use(authenticate);

function monthRange(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!m || m < 1 || m > 12 || !y || y < 2000 || y > 2100) {
    throw Object.assign(new Error('month must be 1-12 and year must be a valid 4-digit year'), { status: 400 });
  }
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

async function getAccountIds() {
  const codes = ['1120', '4100', '4110', '2210', '2220', '2230'];
  const { rows } = await safeQuery(
    `SELECT code, id FROM chart_of_accounts WHERE code = ANY($1)`,
    [codes]
  );
  const map = Object.fromEntries(rows.map((r) => [r.code, r.id]));
  const missing = codes.filter((c) => !map[c]);
  if (missing.length) {
    throw new Error(
      `Missing chart_of_accounts codes: ${missing.join(', ')} — run db/002_platform_sync.sql first`
    );
  }
  return map;
}

// GET /api/platform-sync/preview?month=7&year=2026
// Read-only — fetches from the platform and reports what WOULD be synced,
// without posting anything. Used by the frontend before the one-click sync.
router.get('/preview', requireRole('finance'), async (req, res) => {
  try {
    const { from, to } = monthRange(req.query.month, req.query.year);
    const records = await fetchPlatformIncome(from, to);

    const refIds = records.map((r) => r.ref_id);
    const { rows: already } = refIds.length
      ? await safeQuery(
          `SELECT source, ref_id FROM platform_sync_log WHERE ref_id = ANY($1)`,
          [refIds]
        )
      : { rows: [] };
    const alreadySet = new Set(already.map((r) => `${r.source}:${r.ref_id}`));

    const newRecords = records.filter((r) => !alreadySet.has(`${r.source}:${r.ref_id}`));
    const bySource = { subscription: 0, trade_fee: 0 };
    let totalNewAmount = 0;
    for (const r of newRecords) {
      bySource[r.source] += Number(r.amount_inr);
      totalNewAmount += Number(r.amount_inr);
    }

    res.json({
      from, to,
      totalRecords: records.length,
      newRecords: newRecords.length,
      alreadySynced: records.length - newRecords.length,
      totalNewAmount: Math.round(totalNewAmount * 100) / 100,
      bySource,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/platform-sync/run   body: { month, year }
// The one-click import. Fetches the platform's income feed for the month,
// posts a journal entry per new record, logs each for idempotency, and
// records a summary run.
router.post('/run', requireRole('finance'), async (req, res) => {
  try {
    const { from, to } = monthRange(req.body.month, req.body.year);
    const accts = await getAccountIds();
    const records = await fetchPlatformIncome(from, to);

    let synced = 0, skipped = 0, failed = 0, totalAmount = 0;
    const errors = [];

    for (const r of records) {
      try {
        const { rows: existing } = await safeQuery(
          `SELECT id FROM platform_sync_log WHERE source = $1 AND ref_id = $2`,
          [r.source, r.ref_id]
        );
        if (existing.length) { skipped++; continue; }

        const amount = Number(r.amount_inr);
        const gst = Number(r.gst_inr || 0);
        const cgst = Number(r.cgst_inr || 0);
        const sgst = Number(r.sgst_inr || 0);
        const igst = Number(r.igst_inr || 0);
        const net = Math.round((amount - gst) * 100) / 100;

        const revenueAccountId = r.source === 'trade_fee' ? accts['4110'] : accts['4100'];
        const entryDate = new Date(r.date).toISOString().slice(0, 10);

        const lines = [
          { accountId: accts['1120'], debit: amount, description: r.description },
          { accountId: revenueAccountId, credit: net, description: r.description },
        ];
        if (cgst > 0) lines.push({ accountId: accts['2210'], credit: cgst, description: 'CGST output — platform sync' });
        if (sgst > 0) lines.push({ accountId: accts['2220'], credit: sgst, description: 'SGST output — platform sync' });
        if (igst > 0) lines.push({ accountId: accts['2230'], credit: igst, description: 'IGST output — platform sync' });

        const je = await ledger.postJournalEntry({
          entryDate,
          source: 'platform_sync',
          sourceType: r.source,
          sourceId: String(r.ref_id),
          narration: r.description,
          createdBy: req.staff.id,
          lines,
        });

        await safeQuery(
          `INSERT INTO platform_sync_log (source, ref_id, amount_inr, gst_inr, entry_date, journal_entry_id, synced_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (source, ref_id) DO NOTHING`,
          [r.source, r.ref_id, amount, gst, entryDate, je.id, req.staff.id]
        );

        synced++;
        totalAmount += amount;
      } catch (err) {
        // 23505 = unique_violation — another concurrent sync got there first; treat as skipped, not failed.
        if (err.code === '23505') { skipped++; continue; }
        failed++;
        errors.push({ source: r.source, ref_id: r.ref_id, reason: err.message });
      }
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    await safeQuery(
      `INSERT INTO platform_sync_runs (period_month, period_year, records_synced, records_skipped, records_failed, total_amount_inr, run_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.body.month, req.body.year, synced, skipped, failed, totalAmount, req.staff.id]
    );

    res.json({ from, to, synced, skipped, failed, totalAmount, errors });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/platform-sync/history
// Summary of each "Sync" click — for the top-level history view.
router.get('/history', requireRole('finance'), async (req, res) => {
  const { rows } = await safeQuery(
    `SELECT r.*, s.email AS run_by_email
     FROM platform_sync_runs r LEFT JOIN staff_accounts s ON s.id = r.run_by
     ORDER BY r.run_at DESC LIMIT 24`
  );
  res.json({ runs: rows });
});

// GET /api/platform-sync/log?month=7&year=2026
// Individual synced records (not aggregated runs) for a period, with their
// linked journal entry and void/reversal status — this is what powers the
// "find the mistaken one and void it" admin view. requireRole('finance')
// because it exposes journal_entry_id and internal narration, not just the
// browsing view /records already gives to managers.
router.get('/log', requireRole('finance'), async (req, res) => {
  try {
    const { from, to } = monthRange(req.query.month, req.query.year);
    const { rows } = await safeQuery(
      `SELECT psl.id, psl.source, psl.ref_id, psl.amount_inr, psl.gst_inr, psl.entry_date, psl.synced_at,
              je.entry_number, je.narration, je.reversed_by,
              sa.email AS synced_by_email,
              rev.entry_number AS reversal_entry_number,
              rev.entry_date AS reversal_entry_date,
              rev.narration AS reversal_narration,
              rsa.email AS reversal_created_by_email
       FROM platform_sync_log psl
       JOIN journal_entries je ON je.id = psl.journal_entry_id
       LEFT JOIN staff_accounts sa ON sa.id = psl.synced_by
       LEFT JOIN journal_entries rev ON rev.id = je.reversed_by
       LEFT JOIN staff_accounts rsa ON rsa.id = rev.created_by
       WHERE psl.entry_date BETWEEN $1 AND $2
       ORDER BY psl.entry_date DESC, psl.synced_at DESC`,
      [from, to]
    );
    const withStatus = rows.map((r) => ({ ...r, voided: !!r.reversed_by }));
    res.json({ from, to, records: withStatus });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/platform-sync/records/:logId/void   body: { reason }
// Reverses the journal entry a mistakenly-synced record created. Does NOT
// touch platform_sync_log or the original journal entry — posts an
// equal-and-opposite reversing entry via ledger.reverseJournalEntry, so the
// mistake AND its correction are both visible in the books, forever.
router.post('/records/:logId/void', requireRole('finance'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required to void a synced record' });
    }

    const { rows: [log] } = await safeQuery(
      `SELECT * FROM platform_sync_log WHERE id = $1`,
      [req.params.logId]
    );
    if (!log) return res.status(404).json({ error: 'Sync log record not found' });
    if (!log.journal_entry_id) return res.status(400).json({ error: 'This record has no linked journal entry to void' });

    const { rows: [je] } = await safeQuery(
      `SELECT id, reversed_by FROM journal_entries WHERE id = $1`,
      [log.journal_entry_id]
    );
    if (!je) return res.status(404).json({ error: 'Linked journal entry not found' });
    if (je.reversed_by) return res.status(400).json({ error: 'This record has already been voided' });

    const reversal = await ledger.reverseJournalEntry(log.journal_entry_id, {
      reason: reason.trim(),
      createdBy: req.staff.id,
    });

    res.json({
      voided: true,
      source: log.source,
      refId: log.ref_id,
      originalEntryId: log.journal_entry_id,
      reversalEntry: reversal,
    });
  } catch (err) {
    console.error('[platform-sync:void]', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/platform-sync/records?month=7&year=2026
// Read-only sales register — does NOT post anything to the ledger. Just the
// platform's raw trade + subscription records, formatted for browsing,
// filtering, and export. Separate from /preview and /run, which are about
// the accounting entries specifically.
router.get('/records', requireRole('finance', 'manager'), async (req, res) => {
  try {
    const { from, to } = monthRange(req.query.month, req.query.year);
    const records = await fetchPlatformIncome(from, to);
    res.json({ from, to, records });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/platform-sync/records/:source/:refId/invoice
//
// Proxies the real GST invoice/bill PDF for a single record straight from
// the platform — for GST filing / audit purposes, so you can pull the
// actual signed document instead of relying on the ledger numbers alone.
// Nothing is stored or cached on the ops side; this streams the platform's
// response through on each request, so it always reflects the current
// document (e.g. if a trade invoice gets patched with an on-chain
// confirmation after the fact).
router.get('/records/:source/:refId/invoice', requireRole('finance', 'manager'), async (req, res) => {
  const { source, refId } = req.params;
  const typeMap = { trade_fee: 'trade', subscription: 'subscription' };
  const type = typeMap[source];
  if (!type) {
    return res.status(400).json({ error: "source must be 'trade_fee' or 'subscription'" });
  }

  try {
    const { buffer, filename } = await fetchInvoicePdf(type, refId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/platform-sync/mrr
//
// Monthly Recurring Revenue computed from each active subscriber's actual
// most recent successful payment (latest_subscription_payment_inr, added
// to /api/ops-integration/customers on the EtherTrack side). Annual
// subscribers are normalized to a monthly equivalent (÷12). This naturally
// includes Corporate accounts at their real negotiated price — no hardcoded
// pricing table, no special-casing, and it stays correct automatically if
// standard-tier prices ever change on the platform side.
//
// noPaymentOnRecord catches active subscribers with no successful payment
// row at all (e.g. a plan flag set without a corresponding charge) — these
// are excluded from the MRR total rather than silently counted as ₹0, so
// data issues surface instead of quietly under-reporting revenue.
router.get('/mrr', requireRole('finance', 'manager'), async (req, res) => {
  try {
    const customers = await fetchPlatformCustomers(5000);
    const active = customers.filter((c) => c.is_active && c.subscription_plan && c.subscription_plan !== 'free');

    let mrr = 0;
    const byPlan = {};
    const noPaymentOnRecord = [];

    for (const c of active) {
      const planKey = (c.subscription_plan || '').toLowerCase();
      const lastPaid = c.latest_subscription_payment_inr;

      if (lastPaid == null) {
        noPaymentOnRecord.push({ email: c.email, plan: planKey });
        continue;
      }

      const cycle = (c.subscription_cycle || 'monthly').toLowerCase();
      const monthlyValue = (cycle === 'annual' || cycle === 'yearly')
        ? Number(lastPaid) / 12
        : Number(lastPaid);

      mrr += monthlyValue;
      byPlan[planKey] = (byPlan[planKey] || 0) + monthlyValue;
    }

    mrr = Math.round(mrr * 100) / 100;
    const byPlanRounded = Object.fromEntries(
      Object.entries(byPlan).map(([k, v]) => [k, Math.round(v * 100) / 100])
    );

    res.json({
      mrr,
      arr: Math.round(mrr * 12 * 100) / 100,
      byPlan: byPlanRounded,
      activeSubscribers: active.length,
      noPaymentOnRecord,
      note: noPaymentOnRecord.length
        ? `${noPaymentOnRecord.length} active subscriber(s) have no successful payment on record — excluded from MRR. See noPaymentOnRecord.`
        : null,
    });
  } catch (err) {
    console.error('[platform-sync:mrr]', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/platform-sync/customers?limit=1000
// Read-only customer roster — subscription status + lifetime trade activity,
// for account health / upsell / churn-risk review on the Sales page.
router.get('/customers', requireRole('finance', 'manager'), async (req, res) => {
  try {
    const customers = await fetchPlatformCustomers(req.query.limit);
    res.json({ customers });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;