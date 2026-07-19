'use strict';
// services/email.js
//
// The one place that actually talks to Resend. Extracted out of
// notifications.js so anything that needs to send an email directly
// (password reset, account creation, etc.) — not just in-app notification
// fan-out — uses the same config and the same "never throw" behavior.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@yourcompany.com';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

/**
 * Fails quietly (logs, doesn't throw) — a bad email send should never break
 * the action that triggered it (login flow, approval, etc).
 */
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
      console.error('[email] Resend responded', res.status, await res.text());
    }
  } catch (err) {
    console.error('[email] failed to send', err.message);
  }
}

module.exports = { sendEmail, APP_BASE_URL };