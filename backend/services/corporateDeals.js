'use strict';
// services/corporateDeals.js
//
// A "Corporate deal" = a negotiated term (N months) for a specific
// EtherTrack platform account, billed either as one lump sum, or broken
// into monthly/annual installments — admin's choice per deal, since
// Corporate customers vary (some want to pay once, some want us to send
// payment details each period like a standard renewal reminder).
//
// Each installment is a normal GST invoice (services/invoicing.js — same
// module Finance already uses for every other invoice), so "has period 3
// of 12 been paid" is answered by that invoice's own status/amount_paid —
// no separate/parallel payment tracker. Corporate deals just adds the
// header (deal terms) and links each period to its invoice.
//
// [AUTO-SUSPEND] Platform access now tracks payment for multi-period deals:
// - billing_frequency 'one_time' — full term granted up front, as before
//   (nothing to enforce mid-term, there's only one payment).
// - billing_frequency 'monthly'/'annual' — access is granted ONLY through
//   the end of the current paid period, plus `grace_days` of buffer. When
//   Finance records a payment against an installment invoice in the normal
//   Invoices page (routes/invoices.js POST /:id/payments), that route calls
//   extendAccessForPaidInstallment() below, which pushes the platform's
//   subscription_renewal_date out to cover the next period. If a payment
//   never lands, nothing extends it — the platform's OWN existing expiry
//   enforcement (real-time check in planGate.js + the daily downgrade cron)
//   takes care of the rest automatically. No suspend logic lives here; this
//   just stops artificially extending access past what's actually been paid.
// sendInstallmentReminders() below still fires reminder emails on the same
// schedule regardless — the grace period exists so a customer who pays
// slightly late doesn't get cut off before the reminder even lands.

const { safeQuery: query } = require('../db/pool');
const { createInvoice } = require('./invoicing');
const { sendEmail } = require('./email');
const { activateCorporate, updateCorporateRenewal } = require('./platformClient');

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isoDate(d) { return d.toISOString().slice(0, 10); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
const round2 = (n) => Math.round(n * 100) / 100;

// createCorporateDeal
async function createCorporateDeal({
  partyId, platformUserId, platformEmail,
  termMonths, billingFrequency, seats = null,
  totalValueINR, discountPercent = 0,
  notes = '', createdBy = null, graceDays = 3,
}) {
  if (!partyId) throw Object.assign(new Error('partyId is required'), { status: 400 });
  if (!platformUserId || !platformEmail) throw Object.assign(new Error('platformUserId and platformEmail are required'), { status: 400 });
  if (!Number.isInteger(termMonths) || termMonths < 1) throw Object.assign(new Error('termMonths must be a positive integer'), { status: 400 });
  if (!['one_time', 'monthly', 'annual'].includes(billingFrequency)) throw Object.assign(new Error("billingFrequency must be 'one_time', 'monthly', or 'annual'"), { status: 400 });
  if (totalValueINR == null || isNaN(totalValueINR) || Number(totalValueINR) < 0) throw Object.assign(new Error('totalValueINR must be a non-negative number'), { status: 400 });
  const discount = Number(discountPercent) || 0;
  if (discount < 0 || discount > 100) throw Object.assign(new Error('discountPercent must be between 0 and 100'), { status: 400 });
  if (billingFrequency === 'annual' && termMonths < 12) throw Object.assign(new Error("billingFrequency 'annual' requires termMonths >= 12"), { status: 400 });
  const grace = Number.isInteger(graceDays) && graceDays >= 0 ? graceDays : 3;

  const totalValuePaise = Math.round(Number(totalValueINR) * 100);
  const netValuePaise   = Math.round(totalValuePaise * (1 - discount / 100));

  const numPeriods = billingFrequency === 'one_time' ? 1
    : billingFrequency === 'monthly' ? termMonths
    : Math.ceil(termMonths / 12); // annual

  const periodValuePaise = Math.floor(netValuePaise / numPeriods);
  const periodValueRemainder = netValuePaise - (periodValuePaise * numPeriods); // absorbed into the last period so totals reconcile exactly

  const monthsPerPeriod = billingFrequency === 'monthly' ? 1 : billingFrequency === 'annual' ? 12 : termMonths;
  const startedAt = new Date();

  // Insert deal header
  const { rows: [deal] } = await query(
    `INSERT INTO corporate_deals
       (party_id, platform_user_id, platform_email, term_months, billing_frequency, seats,
        total_value_paise, discount_percent, net_value_paise, started_at, notes, created_by, grace_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [partyId, platformUserId, platformEmail, termMonths, billingFrequency, seats,
     totalValuePaise, discount, netValuePaise, isoDate(startedAt), notes || null, createdBy, grace]
  );

  // Generate one invoice per period
  const installments = [];
  for (let i = 0; i < numPeriods; i++) {
    const periodStart = addMonths(startedAt, i * monthsPerPeriod);
    const periodEnd   = addMonths(startedAt, (i + 1) * monthsPerPeriod);
    const thisPeriodPaise = periodValuePaise + (i === numPeriods - 1 ? periodValueRemainder : 0);
    const unitPriceINR = round2(thisPeriodPaise / 100);

    const invoice = await createInvoice({
      party_id: partyId,
      invoice_date: isoDate(periodStart),
      due_date: isoDate(periodStart), // billed in advance, due at the start of the period
      items: [{
        description: `EtherTrack Corporate Plan — Period ${i + 1} of ${numPeriods} (${fmtDate(periodStart)} – ${fmtDate(new Date(periodEnd.getTime() - 86400000))})`,
        quantity: 1,
        unit_price: unitPriceINR,
        gst_rate: 18,
      }],
      notes: notes || null,
      createdBy,
    });

    const { rows: [installment] } = await query(
      `INSERT INTO corporate_deal_installments (deal_id, period_number, period_start, period_end, invoice_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [deal.id, i + 1, isoDate(periodStart), isoDate(periodEnd), invoice.id]
    );
    installments.push({ ...installment, invoice });
  }

  // [AUTO-SUSPEND] One-time deals still get the whole term up front — there's
  // only one payment, nothing to enforce mid-term. Multi-period deals only
  // get access through the END OF PERIOD 1 + grace_days — access for later
  // periods is granted as each installment is actually paid (see
  // extendAccessForPaidInstallment below), not up front.
  const firstPeriodEnd = numPeriods > 1 ? addMonths(startedAt, monthsPerPeriod) : addMonths(startedAt, termMonths);
  const initialRenewalDate = billingFrequency === 'one_time'
    ? firstPeriodEnd
    : addDays(firstPeriodEnd, grace);

  try {
    await activateCorporate(platformUserId, {
      cycle: billingFrequency === 'monthly' ? 'monthly' : 'annual',
      seats, customPriceINR: round2(netValuePaise / 100),
      renewalMonths: 1, notes, // placeholder — overwritten by the exact-date call below
    });
    await updateCorporateRenewal(platformUserId, {
      renewalDate: initialRenewalDate.toISOString(), seats,
      notes: numPeriods > 1 ? `Corporate deal created — access covers period 1 of ${numPeriods} + ${grace}-day grace` : 'Corporate deal created',
    });
  } catch (e) {
    // Deal + invoices are already committed at this point — surface the
    // platform-activation failure clearly rather than rolling back finance
    // records, since re-running invoice generation would duplicate them.
    // The admin can retry activation alone from the Corporate Deals page.
    console.error('[corporateDeals:create] platform activation failed (deal/invoices already created):', e.message);
    return { deal, installments, platformActivationError: e.message };
  }

  return { deal, installments, platformActivationError: null };
}

// extendAccessForPaidInstallment — called from routes/invoices.js right after
// an invoice flips to status='paid', if that invoice is a corporate deal
// installment. Extends the platform account's access to cover through the
// END of the period that was just paid, plus the deal's grace_days (buffer
// for the NEXT installment to come in before access actually lapses). If
// this was the LAST installment, extends to exactly the period end (no more
// grace needed — the term is genuinely over) and marks the deal completed.
// No-ops for 'one_time' deals (already covered the whole term) and for
// invoices that aren't a corporate deal installment at all.
async function extendAccessForPaidInstallment(invoiceId) {
  const { rows: [row] } = await query(
    `SELECT ci.deal_id, ci.period_number, ci.period_end,
            d.platform_user_id, d.billing_frequency, d.term_months, d.grace_days, d.status AS deal_status, d.seats
     FROM corporate_deal_installments ci
     JOIN corporate_deals d ON d.id = ci.deal_id
     WHERE ci.invoice_id = $1`,
    [invoiceId]
  );
  if (!row || row.billing_frequency === 'one_time' || row.deal_status !== 'active') return { extended: false };

  const numPeriods = row.billing_frequency === 'monthly' ? row.term_months : Math.ceil(row.term_months / 12);
  const isLastPeriod = row.period_number >= numPeriods;

  const newRenewalDate = isLastPeriod
    ? new Date(row.period_end)
    : addDays(new Date(row.period_end), row.grace_days);

  try {
    await updateCorporateRenewal(row.platform_user_id, {
      renewalDate: newRenewalDate.toISOString(), seats: row.seats,
      notes: isLastPeriod
        ? `Final installment (${row.period_number}/${numPeriods}) paid — term complete`
        : `Installment ${row.period_number}/${numPeriods} paid — access extended`,
    });
  } catch (e) {
    console.error('[corporateDeals:extendAccess] updateCorporateRenewal failed:', e.message);
    return { extended: false, error: e.message };
  }

  if (isLastPeriod) {
    await query(`UPDATE corporate_deals SET status = 'completed' WHERE id = $1`, [row.deal_id]).catch(() => {});
  }

  return { extended: true, newRenewalDate, isLastPeriod };
}

async function listCorporateDeals() {
  const { rows: deals } = await query(
    `SELECT d.*, p.name AS party_name, p.email AS party_email
     FROM corporate_deals d
     JOIN parties p ON p.id = d.party_id
     ORDER BY d.created_at DESC`
  );
  const { rows: installments } = await query(
    `SELECT ci.deal_id, ci.period_number, ci.period_start, ci.period_end, ci.invoice_id,
            i.invoice_number, i.status AS invoice_status, i.total_amount, i.amount_paid, i.due_date
     FROM corporate_deal_installments ci
     JOIN invoices i ON i.id = ci.invoice_id
     ORDER BY ci.deal_id, ci.period_number`
  );
  const byDeal = new Map();
  for (const inst of installments) {
    if (!byDeal.has(inst.deal_id)) byDeal.set(inst.deal_id, []);
    byDeal.get(inst.deal_id).push(inst);
  }
  return deals.map(d => ({
    ...d,
    installments: byDeal.get(d.id) || [],
  }));
}

async function getCorporateDeal(dealId) {
  const { rows: [deal] } = await query(
    `SELECT d.*, p.name AS party_name, p.email AS party_email
     FROM corporate_deals d JOIN parties p ON p.id = d.party_id
     WHERE d.id = $1`, [dealId]
  );
  if (!deal) return null;
  const { rows: installments } = await query(
    `SELECT ci.*, i.invoice_number, i.status AS invoice_status, i.total_amount, i.amount_paid, i.due_date
     FROM corporate_deal_installments ci JOIN invoices i ON i.id = ci.invoice_id
     WHERE ci.deal_id = $1 ORDER BY ci.period_number`, [dealId]
  );
  return { ...deal, installments };
}

// sendInstallmentReminders — cron-callable. Finds unpaid installments due
// within 7/1/0 days (or overdue, reminded no more than once every 3 days),
// emails the corporate contact with payment details, and cc's the internal
// finance/admin inbox so a human can chase it if it lapses.
async function sendInstallmentReminders() {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.FINANCE_EMAIL;
  const { rows } = await query(
    `SELECT ci.id, ci.period_number, ci.reminder_sent_at,
            i.invoice_number, i.due_date, i.total_amount, i.status,
            d.platform_email, d.term_months, d.billing_frequency,
            p.name AS party_name, p.email AS party_email
     FROM corporate_deal_installments ci
     JOIN invoices i ON i.id = ci.invoice_id
     JOIN corporate_deals d ON d.id = ci.deal_id
     JOIN parties p ON p.id = d.party_id
     WHERE i.status IN ('sent','partially_paid','overdue')
       AND d.status = 'active'
       AND (
         i.due_date - CURRENT_DATE IN (7, 1, 0)
         OR i.due_date < CURRENT_DATE
       )`
  );

  let sent = 0;
  for (const row of rows) {
    const daysUntil = Math.ceil((new Date(row.due_date) - new Date()) / 86400000);
    const isOverdue = daysUntil < 0;
    // Throttle: at most one reminder per 24h for upcoming dues, per 72h once overdue
    const minGapMs = isOverdue ? 3 * 86400000 : 24 * 3600000;
    if (row.reminder_sent_at && (Date.now() - new Date(row.reminder_sent_at).getTime()) < minGapMs) continue;

    const to = row.party_email || row.platform_email;
    if (!to) continue;

    const subject = isOverdue
      ? `Payment overdue — ${row.invoice_number} (EtherTrack Corporate)`
      : daysUntil === 0
        ? `Payment due today — ${row.invoice_number} (EtherTrack Corporate)`
        : `Upcoming renewal — ${row.invoice_number} due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;

    const html = `
      <p>Hi ${row.party_name},</p>
      <p>${isOverdue
        ? `Invoice <strong>${row.invoice_number}</strong> (₹${row.total_amount}) for your EtherTrack Corporate plan was due on ${fmtDate(row.due_date)} and is now overdue.`
        : `Your EtherTrack Corporate plan renewal — invoice <strong>${row.invoice_number}</strong> (₹${row.total_amount}) — is due on ${fmtDate(row.due_date)}.`
      }</p>
      <p>Please arrange payment to continue uninterrupted access. Reach out to your account manager at support@ethertrack.in if you have any questions or need payment details resent.</p>
      <p>— EtherTrack</p>
    `;

    try {
      await sendEmail({ to, subject, html });
      if (adminEmail && adminEmail !== to) {
        await sendEmail({
          to: adminEmail,
          subject: `[Internal] ${subject} — ${row.party_name}`,
          html: `<p>Reminder sent to ${to} for installment ${row.period_number} (${row.invoice_number}, ₹${row.total_amount}, due ${fmtDate(row.due_date)}).</p><p>Status: ${isOverdue ? 'OVERDUE' : `due in ${daysUntil} day(s)`}.</p>`,
        }).catch(() => {});
      }
      await query(`UPDATE corporate_deal_installments SET reminder_sent_at = NOW() WHERE id = $1`, [row.id]);
      sent++;
    } catch (e) {
      console.warn('[corporateDeals:reminders] send failed for', row.invoice_number, e.message);
    }
  }
  console.log(`[corporateDeals:reminders] sent ${sent} reminder(s)`);
  return { sent };
}

// cancelCorporateDeal — manual early termination, for when a customer
// requests cancellation rather than just missing a payment. Marks the deal
// 'cancelled' and cuts platform access immediately (sets renewal_date to
// now, so the platform's own real-time expiry check + downgrade cron take
// it from here — same mechanism as a missed installment, just triggered by
// a human action instead of a payment deadline passing). Does NOT touch
// already-issued invoices — any unpaid ones stay in Accounting as-is for
// Finance to write off or chase separately; this only stops future access
// and future reminder emails (sendInstallmentReminders already filters on
// deal.status = 'active', so a cancelled deal's remaining installments stop
// generating reminders automatically).
async function cancelCorporateDeal(dealId, reason, staffId) {
  const { rows: [deal] } = await query(
    `SELECT * FROM corporate_deals WHERE id = $1`, [dealId]
  );
  if (!deal) throw Object.assign(new Error('Deal not found'), { status: 404 });
  if (deal.status !== 'active') throw Object.assign(new Error(`Deal is already ${deal.status}`), { status: 400 });
  if (!reason || !reason.trim()) throw Object.assign(new Error('A cancellation reason is required'), { status: 400 });

  await query(
    `UPDATE corporate_deals SET status = 'cancelled', notes = COALESCE(notes,'') || $1 WHERE id = $2`,
    [`\n[CANCELLED ${new Date().toISOString()} by staff ${staffId}]: ${reason.trim()}`, dealId]
  );

  try {
    await updateCorporateRenewal(deal.platform_user_id, {
      renewalDate: new Date().toISOString(),
      notes: `Corporate deal cancelled: ${reason.trim()}`,
    });
  } catch (e) {
    console.error('[corporateDeals:cancel] platform access cutoff failed (deal already marked cancelled):', e.message);
    return { cancelled: true, platformAccessError: e.message };
  }

  return { cancelled: true, platformAccessError: null };
}

module.exports = { createCorporateDeal, listCorporateDeals, getCorporateDeal, sendInstallmentReminders, extendAccessForPaidInstallment, cancelCorporateDeal };