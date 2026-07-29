'use strict';

const { logAction } = require('../services/auditLog');

/**
 * exportGuard
 * -----------------------------------------------------------------------
 * The frontend deterrents in SecurityGuard.js stop casual copy/paste and
 * printing, but the ACTUAL exfiltration risk for an ERP is data leaving
 * through the backend: CSV/PDF export endpoints, "email this report to"
 * fields, webhook/integration configs, etc. Those are things this server
 * controls completely, so this is where a real guarantee (not just a
 * deterrent) can be enforced.
 *
 * Two middlewares:
 *
 *  1. restrictToInternalDomain(fieldPath, opts)
 *     Blocks any request whose recipient email(s) aren't on your
 *     company's approved domain list. Use on any route that emails,
 *     shares, or exports data to an address supplied in the request body.
 *
 *  2. auditExport(action)
 *     Logs every successful export/download (who, what, when, from what
 *     IP) to your existing audit log service, so even internal exports
 *     are traceable.
 *
 * Wire-up example (backend/routes/invoices.js):
 *   const { restrictToInternalDomain, auditExport } = require('../middleware/exportGuard');
 *   router.post('/:id/email', authenticate, restrictToInternalDomain('to'), auditExport('invoice_email'), handler);
 *   router.get('/:id/export', authenticate, auditExport('invoice_export'), handler);
 *
 * Configure ALLOWED_EXPORT_DOMAINS in your .env, e.g.:
 *   ALLOWED_EXPORT_DOMAINS=etherack.example.com,ethertrack.com
 */

function getAllowedDomains() {
  const raw = process.env.ALLOWED_EXPORT_DOMAINS || '';
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function extractEmails(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(extractEmails);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

/**
 * fieldPath: dot path into req.body where the recipient email(s) live,
 * e.g. 'to' or 'recipients.email'. Accepts a single address or a
 * comma-separated / array list.
 */
function restrictToInternalDomain(fieldPath, opts = {}) {
  return async (req, res, next) => {
    try {
      const allowed = opts.allowedDomains || getAllowedDomains();
      if (allowed.length === 0) {
        // Fail closed: if nobody has configured an allow-list, don't
        // silently permit exports to anywhere.
        return res.status(500).json({
          error: 'External export is not configured. Set ALLOWED_EXPORT_DOMAINS before enabling this route.',
        });
      }

      const value = fieldPath.split('.').reduce((o, k) => (o ? o[k] : undefined), req.body);
      const emails = extractEmails(value);

      if (emails.length === 0) {
        return res.status(400).json({ error: `Missing recipient field '${fieldPath}'` });
      }

      const blocked = emails.filter((email) => {
        const domain = email.split('@')[1]?.toLowerCase();
        return !domain || !allowed.includes(domain);
      });

      if (blocked.length > 0) {
        await logAction({
          staffId: req.staff?.id,
          action: 'export.blocked_external_domain',
          entity: 'export_guard',
          newValue: { field: fieldPath, blockedRecipients: blocked, route: req.originalUrl },
          ipAddress: req.ip,
        }).catch(() => {});

        return res.status(403).json({
          error: 'Sending or exporting data to external email addresses is not permitted.',
          blocked,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Logs a successful export/download after the handler completes, so you
 * have a record of every export even when it stayed internal.
 */
function auditExport(action) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAction({
          staffId: req.staff?.id,
          action,
          entity: 'export_guard',
          newValue: { route: req.originalUrl, method: req.method },
          ipAddress: req.ip,
        }).catch(() => {});
      }
    });
    next();
  };
}

module.exports = { restrictToInternalDomain, auditExport, getAllowedDomains };