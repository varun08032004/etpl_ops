'use strict';
// services/notifications.js
//
// Two channels, one call: notifyStaff() writes the in-app notification row
// AND fires an email via Resend (https://resend.com — set RESEND_API_KEY
// and RESEND_FROM_EMAIL in .env). Email failures never throw — a bad email
// send shouldn't break the underlying action (approval created, leave
// approved, etc.), so it's logged and swallowed.

const { safeQuery } = require('../db/pool');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@yourcompany.com';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY || !to) return; // not configured, or recipient has no email on file — skip quietly
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[notifications:email] Resend responded', res.status, await res.text());
    }
  } catch (err) {
    console.error('[notifications:email] failed to send', err.message);
  }
}

/**
 * Writes an in-app notification for one staff member and emails them.
 * @param {object} params
 * @param {string} params.staffId
 * @param {string} params.type - e.g. 'approval.requested', 'approval.approved', 'leave.approved'
 * @param {string} params.title
 * @param {string} [params.body]
 * @param {string} [params.link] - relative frontend path, e.g. '/employees/abc-123'
 */
async function notifyStaff({ staffId, type, title, body, link }) {
  const { rows: [row] } = await safeQuery(
    `INSERT INTO notifications (staff_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [staffId, type, title, body || null, link || null]
  );

  const { rows: [staff] } = await safeQuery(`SELECT email FROM staff_accounts WHERE id = $1`, [staffId]);
  if (staff?.email) {
    const linkHtml = link ? `<p><a href="${APP_BASE_URL}${link}">Open in EtherTrack →</a></p>` : '';
    await sendEmail({
      to: staff.email,
      subject: title,
      html: `<div style="font-family:sans-serif"><p>${body || title}</p>${linkHtml}</div>`,
    });
  }

  return row;
}

/** Fan-out helper — same notification to several staff members (e.g. all admins at an approval stage). */
async function notifyMany(staffIds, params) {
  return Promise.all((staffIds || []).map((staffId) => notifyStaff({ ...params, staffId })));
}

module.exports = { notifyStaff, notifyMany };