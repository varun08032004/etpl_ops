// ─────────────────────────────────────────────────────────────────────────
// services/emailService.js
//
// Generic SMTP sender for the document engine's "auto email" step. Real
// send when INTERNAL_OPS_SMTP_* env vars are configured; otherwise falls
// back to a console-logged stub (same philosophy as automationEngine.js's
// send_email action) so the rest of the flow can be tested end-to-end
// without a mail provider wired up yet.
//
// Works with any standard SMTP provider (Gmail app password, SES SMTP
// interface, Postmark, Zoho Mail, etc.) — set:
//   INTERNAL_OPS_SMTP_HOST, INTERNAL_OPS_SMTP_PORT, INTERNAL_OPS_SMTP_USER,
//   INTERNAL_OPS_SMTP_PASS, INTERNAL_OPS_SMTP_FROM
// ─────────────────────────────────────────────────────────────────────────
'use strict';

let nodemailer;
try { nodemailer = require('nodemailer'); } catch (_) { /* not installed yet — stub mode only */ }

function isConfigured() {
  return !!(nodemailer && process.env.INTERNAL_OPS_SMTP_HOST && process.env.INTERNAL_OPS_SMTP_USER && process.env.INTERNAL_OPS_SMTP_PASS);
}

let cachedTransport = null;
function getTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: process.env.INTERNAL_OPS_SMTP_HOST,
    port: Number(process.env.INTERNAL_OPS_SMTP_PORT || 587),
    secure: Number(process.env.INTERNAL_OPS_SMTP_PORT) === 465,
    auth: { user: process.env.INTERNAL_OPS_SMTP_USER, pass: process.env.INTERNAL_OPS_SMTP_PASS },
  });
  return cachedTransport;
}

/**
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.text
 * @param {Array<{filename:string, content:Buffer}>} [params.attachments]
 * @returns {Promise<{sent:boolean, stub?:boolean}>}
 */
async function sendMail({ to, subject, text, attachments }) {
  if (!isConfigured()) {
    console.log('[emailService:STUB] No SMTP configured — would send:', { to, subject, attachments: (attachments || []).map((a) => a.filename) });
    return { sent: false, stub: true };
  }
  try {
    await getTransport().sendMail({
      from: process.env.INTERNAL_OPS_SMTP_FROM || process.env.INTERNAL_OPS_SMTP_USER,
      to, subject, text, attachments,
    });
    return { sent: true };
  } catch (err) {
    console.error('[emailService] send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail, isConfigured };
