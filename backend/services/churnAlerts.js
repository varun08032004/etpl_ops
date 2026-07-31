'use strict';
// services/churnAlerts.js
//
// Pulls paid→free downgrade events from the platform (GET
// /api/ops-integration/churn-events) and emails a digest to Sales/CS so
// someone can do win-back outreach same-day, instead of only noticing a
// churned customer the next time someone happens to re-pull the customer
// roster in the Subscriptions page.
//
// Re-pulls a rolling window (last 3 days) on every run rather than tracking
// a "since" cursor precisely — cheap, and immune to clock drift/missed runs
// silently losing events. Dedup against re-alerting happens locally via
// churn_events_seen (see db/manual-migrations/2026-07-30-churn-alerts.sql).

const { safeQuery: query } = require('../db/pool');
const { fetchChurnEvents } = require('./platformClient');
const { sendEmail } = require('./email');

const ALERT_EMAIL = process.env.SALES_EMAIL || process.env.ADMIN_EMAIL;

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

async function checkAndAlertChurn() {
  if (!ALERT_EMAIL) {
    console.warn('[churnAlerts] SALES_EMAIL/ADMIN_EMAIL not set — skipping (nowhere to send the digest)');
    return { checked: 0, alerted: 0 };
  }

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3-day rolling window
  let events;
  try {
    events = await fetchChurnEvents(since);
  } catch (e) {
    console.error('[churnAlerts] fetchChurnEvents failed:', e.message);
    return { checked: 0, alerted: 0, error: e.message };
  }

  if (!events.length) {
    console.log('[churnAlerts] No downgrade events in the last 3 days.');
    return { checked: 0, alerted: 0 };
  }

  // Filter out ones we've already alerted on
  const { rows: seenRows } = await query(
    `SELECT event_id FROM churn_events_seen WHERE event_id = ANY($1)`,
    [events.map(e => e.event_id)]
  );
  const seenIds = new Set(seenRows.map(r => r.event_id));
  const newEvents = events.filter(e => !seenIds.has(e.event_id));

  if (!newEvents.length) {
    console.log(`[churnAlerts] ${events.length} event(s) in window, all already alerted.`);
    return { checked: events.length, alerted: 0 };
  }

  // Cross-reference against CRM parties by email, purely for display context
  // in the digest (e.g. "matches your Acme Corp party") — no writes to
  // parties, this is read-only enrichment.
  const { rows: partyMatches } = await query(
    `SELECT id, name, email FROM parties WHERE email = ANY($1)`,
    [newEvents.map(e => e.email)]
  );
  const partyByEmail = new Map(partyMatches.map(p => [p.email, p.name]));

  const rowsHtml = newEvents.map(e => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #333">${e.full_name || '—'}<br><span style="color:#888;font-size:12px">${e.email}</span></td>
      <td style="padding:6px 10px;border-bottom:1px solid #333;text-transform:capitalize">${e.from_plan || '—'} (${e.from_cycle || '—'})</td>
      <td style="padding:6px 10px;border-bottom:1px solid #333">${fmtDate(e.downgraded_at)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #333">${e.corporate_managed ? 'Corporate' : (partyByEmail.get(e.email) ? `Matches CRM party: ${partyByEmail.get(e.email)}` : '—')}</td>
    </tr>
  `).join('');

  const html = `
    <p>${newEvents.length} paying customer${newEvents.length !== 1 ? 's' : ''} dropped to the Free plan in the last 3 days. Worth a win-back outreach:</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="text-align:left;background:#1a1a1a">
          <th style="padding:6px 10px">Customer</th>
          <th style="padding:6px 10px">Was on</th>
          <th style="padding:6px 10px">Downgraded</th>
          <th style="padding:6px 10px">Notes</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  try {
    await sendEmail({
      to: ALERT_EMAIL,
      subject: `📉 ${newEvents.length} subscription${newEvents.length !== 1 ? 's' : ''} churned — win-back opportunity`,
      html,
    });
  } catch (e) {
    console.error('[churnAlerts] sendEmail failed:', e.message);
    return { checked: events.length, alerted: 0, error: e.message };
  }

  for (const e of newEvents) {
    await query(
      `INSERT INTO churn_events_seen (event_id, email, from_plan, downgraded_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (event_id) DO NOTHING`,
      [e.event_id, e.email, e.from_plan, e.downgraded_at]
    ).catch(err => console.warn('[churnAlerts] failed to mark event seen:', err.message));
  }

  console.log(`[churnAlerts] Alerted on ${newEvents.length} new churn event(s), sent to ${ALERT_EMAIL}.`);
  return { checked: events.length, alerted: newEvents.length };
}

module.exports = { checkAndAlertChurn };