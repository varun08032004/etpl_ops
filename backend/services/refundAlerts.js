'use strict';
// services/refundAlerts.js
//
// Daily check for platform refunds whose revenue was already imported into
// the ledger (platform_sync_log has an entry, not yet voided) — emails
// Finance a reminder to void it via the existing Platform Sync Log page,
// rather than reversing it automatically. Real-money ledger corrections
// stay a deliberate, reason-required human action (see
// routes/platform-sync.js's /records/:logId/void) — this just makes sure
// nobody has to remember to go looking for refunds.

const { safeQuery: query } = require('../db/pool');
const { fetchPlatformRefunds } = require('./platformClient');
const { sendEmail } = require('./email');

const ALERT_EMAIL = process.env.FINANCE_EMAIL || process.env.ADMIN_EMAIL;

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

async function checkRefundsNeedingReversal() {
  if (!ALERT_EMAIL) {
    console.warn('[refundAlerts] FINANCE_EMAIL/ADMIN_EMAIL not set — skipping (nowhere to send the digest)');
    return { checked: 0, needsReversal: 0 };
  }

  let refunds;
  try {
    refunds = await fetchPlatformRefunds(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  } catch (e) {
    console.error('[refundAlerts] fetchPlatformRefunds failed:', e.message);
    return { checked: 0, needsReversal: 0, error: e.message };
  }

  if (!refunds.length) return { checked: 0, needsReversal: 0 };

  const refIds = refunds.map((r) => String(r.ref_id));
  const { rows: logRows } = await query(
    `SELECT psl.ref_id, je.reversed_by
     FROM platform_sync_log psl
     JOIN journal_entries je ON je.id = psl.journal_entry_id
     WHERE psl.source = 'subscription' AND psl.ref_id = ANY($1)`,
    [refIds]
  );
  const logByRefId = new Map(logRows.map((r) => [r.ref_id, r]));

  const needsReversal = refunds.filter((r) => {
    const log = logByRefId.get(String(r.ref_id));
    return log && !log.reversed_by; // posted to the ledger, refunded, not yet voided
  });

  if (!needsReversal.length) {
    console.log(`[refundAlerts] ${refunds.length} refund(s) in the last 90 days, none need reversal.`);
    return { checked: refunds.length, needsReversal: 0 };
  }

  // Dedup against re-alerting the same refund every day — track in a tiny
  // table, same pattern as churn_events_seen.
  const { rows: alreadyAlerted } = await query(
    `SELECT ref_id FROM refund_alerts_sent WHERE ref_id = ANY($1)`,
    [needsReversal.map((r) => String(r.ref_id))]
  );
  const alertedSet = new Set(alreadyAlerted.map((r) => r.ref_id));
  const freshAlerts = needsReversal.filter((r) => !alertedSet.has(String(r.ref_id)));

  if (!freshAlerts.length) {
    console.log(`[refundAlerts] ${needsReversal.length} refund(s) need reversal, all already alerted.`);
    return { checked: refunds.length, needsReversal: needsReversal.length };
  }

  const rowsHtml = freshAlerts.map((r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #333">${r.customer_name || '—'}<br><span style="color:#888;font-size:12px">${r.customer_email || '—'}</span></td>
      <td style="padding:6px 10px;border-bottom:1px solid #333;text-transform:capitalize">${r.plan || '—'} (${r.cycle || '—'})</td>
      <td style="padding:6px 10px;border-bottom:1px solid #333">₹${Number(r.refund_amount_inr).toLocaleString('en-IN')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #333">${fmtDate(r.refunded_at)}</td>
    </tr>
  `).join('');

  try {
    await sendEmail({
      to: ALERT_EMAIL,
      subject: `⚠️ ${freshAlerts.length} refund${freshAlerts.length !== 1 ? 's' : ''} need a reversing entry in the ledger`,
      html: `
        <p>${freshAlerts.length} subscription refund${freshAlerts.length !== 1 ? 's' : ''} on the platform ${freshAlerts.length !== 1 ? 'have' : 'has'} revenue already posted to the ledger that hasn't been reversed yet.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <thead><tr style="text-align:left;background:#1a1a1a">
            <th style="padding:6px 10px">Customer</th><th style="padding:6px 10px">Plan</th>
            <th style="padding:6px 10px">Refund Amount</th><th style="padding:6px 10px">Refunded On</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="margin-top:16px">Go to <strong>Accounting → Platform Sync Log</strong> — the Refunds section there has a one-click "Void" button for each of these, pre-filled with the reason.</p>
      `,
    });
  } catch (e) {
    console.error('[refundAlerts] sendEmail failed:', e.message);
    return { checked: refunds.length, needsReversal: needsReversal.length, error: e.message };
  }

  for (const r of freshAlerts) {
    await query(
      `INSERT INTO refund_alerts_sent (ref_id, refund_ref, alerted_at)
       VALUES ($1,$2,NOW()) ON CONFLICT (ref_id) DO NOTHING`,
      [String(r.ref_id), r.refund_ref]
    ).catch((err) => console.warn('[refundAlerts] failed to mark alert sent:', err.message));
  }

  console.log(`[refundAlerts] Alerted on ${freshAlerts.length} refund(s) needing reversal, sent to ${ALERT_EMAIL}.`);
  return { checked: refunds.length, needsReversal: needsReversal.length, alerted: freshAlerts.length };
}

module.exports = { checkRefundsNeedingReversal };