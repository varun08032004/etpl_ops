'use strict';
// routes/esignatures.js
//
// Two halves, deliberately split by auth:
//   - Everything under /esignatures/*        → authenticate() required (internal tracking)
//   - Everything under /esignatures/sign/:token → PUBLIC, no auth (external signers
//     don't have — and shouldn't need — a staff login just to sign one document)
//
// A signer either has staff_id (an internal user, must be logged in to sign
// via POST /:id/sign-as-staff) or a token_hash (external signer, signs via
// the public link) — never both.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { notifyStaff } = require('../services/notifications');
const { sendEmail, APP_BASE_URL } = require('../services/email');

// ═══════════════════════ PUBLIC — no authenticate() on these ═══════════════

router.get('/sign/:token', async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const { rows: [signer] } = await safeQuery(
      `SELECT ss.id, ss.name, ss.email, ss.role_label, ss.status, ss.signed_at,
              sr.id AS request_id, sr.title, sr.status AS request_status
       FROM signature_signers ss JOIN signature_requests sr ON sr.id = ss.signature_request_id
       WHERE ss.token_hash = $1`,
      [tokenHash]
    );
    if (!signer) return res.status(404).json({ error: 'This signing link is invalid.' });
    if (signer.request_status === 'voided') return res.status(410).json({ error: 'This request has been withdrawn — no signature is needed.' });
    res.json({ signer });
  } catch (err) {
    console.error('[esignatures:sign:get]', err);
    res.status(500).json({ error: 'Failed to load signing request' });
  }
});

router.post('/sign/:token', async (req, res) => {
  try {
    const { signed_name, decline, decline_reason } = req.body;
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const { rows: [signer] } = await safeQuery(
      `SELECT ss.*, sr.title, sr.status AS request_status FROM signature_signers ss
       JOIN signature_requests sr ON sr.id = ss.signature_request_id
       WHERE ss.token_hash = $1`,
      [tokenHash]
    );
    if (!signer) return res.status(404).json({ error: 'This signing link is invalid.' });
    if (signer.request_status === 'voided') return res.status(410).json({ error: 'This request has been withdrawn.' });
    if (signer.status !== 'pending') return res.status(400).json({ error: `You have already ${signer.status} this.` });

    if (decline) {
      await safeQuery(
        `UPDATE signature_signers SET status = 'declined', decline_reason = $1, signed_at = NOW() WHERE id = $2`,
        [decline_reason || null, signer.id]
      );
    } else {
      if (!signed_name || !signed_name.trim()) return res.status(400).json({ error: 'Type your full name to sign.' });
      await safeQuery(
        `UPDATE signature_signers
         SET status = 'signed', signed_name = $1, signed_at = NOW(), ip_address = $2, user_agent = $3, token_hash = NULL
         WHERE id = $4`,
        [signed_name.trim(), req.ip || null, (req.headers['user-agent'] || '').slice(0, 300), signer.id]
      );
    }

    await maybeCompleteRequest(signer.signature_request_id);
    res.json({ ok: true, status: decline ? 'declined' : 'signed' });
  } catch (err) {
    console.error('[esignatures:sign:post]', err);
    res.status(500).json({ error: 'Failed to record your response' });
  }
});

// Checks whether every signer on a request has responded (signed or
// declined); if all have signed, marks the request completed and notifies
// whoever created it. A single decline does NOT auto-void the request —
// that's a judgment call for the creator, so it's left pending for them to
// review and void manually if needed.
async function maybeCompleteRequest(signatureRequestId) {
  const { rows: signers } = await safeQuery(`SELECT status FROM signature_signers WHERE signature_request_id = $1`, [signatureRequestId]);
  const allDone = signers.every((s) => s.status !== 'pending');
  const allSigned = signers.every((s) => s.status === 'signed');
  if (!allDone) return;

  if (allSigned) {
    const { rows: [request] } = await safeQuery(
      `UPDATE signature_requests SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *`,
      [signatureRequestId]
    );
    await notifyStaff({
      staffId: request.created_by, type: 'esignature.completed',
      title: `All signatures collected: "${request.title}"`, link: '/esignatures',
    });
  }
  // If not all signed (some declined), leave status as 'pending' so the
  // creator sees it needs attention rather than silently disappearing.
}

// ═══════════════════════ AUTHENTICATED ══════════════════════════════════════

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { entity_type, entity_id, status } = req.query;
    const conditions = [];
    const params = [];
    if (entity_type) { params.push(entity_type); conditions.push(`sr.entity_type = $${params.length}`); }
    if (entity_id) { params.push(entity_id); conditions.push(`sr.entity_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`sr.status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT sr.*, req.email AS created_by_email,
              COUNT(ss.id) AS signer_count,
              COUNT(ss.id) FILTER (WHERE ss.status = 'signed') AS signed_count
       FROM signature_requests sr
       LEFT JOIN staff_accounts req ON req.id = sr.created_by
       LEFT JOIN signature_signers ss ON ss.signature_request_id = sr.id
       ${where}
       GROUP BY sr.id, req.email
       ORDER BY sr.created_at DESC`,
      params
    );
    res.json({ requests: rows.map((r) => ({ ...r, signer_count: Number(r.signer_count), signed_count: Number(r.signed_count) })) });
  } catch (err) {
    console.error('[esignatures:list]', err);
    res.status(500).json({ error: 'Failed to fetch signature requests' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [request] } = await safeQuery(`SELECT * FROM signature_requests WHERE id = $1`, [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Signature request not found' });
    const { rows: signers } = await safeQuery(
      `SELECT id, name, email, role_label, status, signed_name, signed_at, decline_reason, order_index
       FROM signature_signers WHERE signature_request_id = $1 ORDER BY order_index, created_at`,
      [req.params.id]
    );
    res.json({ request, signers });
  } catch (err) {
    console.error('[esignatures:get]', err);
    res.status(500).json({ error: 'Failed to fetch signature request' });
  }
});

// Create a request and email each external signer their unique link.
// Internal signers (staff_id set) get an in-app notification instead — they
// sign while logged in via POST /:id/signers/:signerId/sign-as-staff.
router.post('/', requireRole('hr'), async (req, res) => {
  try {
    const { title, entity_type, entity_id, document_id, signers } = req.body;
    if (!title || !Array.isArray(signers) || signers.length < 1) {
      return res.status(400).json({ error: 'title and at least one signer are required' });
    }

    const { rows: [request] } = await safeQuery(
      `INSERT INTO signature_requests (title, entity_type, entity_id, document_id, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, entity_type || null, entity_id || null, document_id || null, req.staff.id]
    );

    for (const [i, s] of signers.entries()) {
      if (!s.name || !s.email) continue;
      let tokenHash = null;
      let rawToken = null;
      if (!s.staff_id) {
        rawToken = crypto.randomBytes(32).toString('hex');
        tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      }

      const { rows: [signer] } = await safeQuery(
        `INSERT INTO signature_signers (signature_request_id, name, email, role_label, staff_id, token_hash, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [request.id, s.name, s.email, s.role_label || null, s.staff_id || null, tokenHash, s.order_index || 0]
      );

      if (s.staff_id) {
        await notifyStaff({
          staffId: s.staff_id, type: 'esignature.requested',
          title: `Signature needed: "${title}"`, link: '/esignatures',
        });
      } else {
        const signUrl = `${APP_BASE_URL}/sign/${rawToken}`;
        await sendEmail({
          to: s.email,
          subject: `Signature requested: ${title}`,
          html: `<div style="font-family:sans-serif">
            <p>${s.name}, you've been asked to sign "${title}".</p>
            <p><a href="${signUrl}">Click here to review and sign</a></p>
          </div>`,
        });
      }
    }

    res.status(201).json({ request });
  } catch (err) {
    console.error('[esignatures:create]', err);
    res.status(500).json({ error: 'Failed to create signature request' });
  }
});

// Internal signer, already logged in — no token needed, just confirm it's their own signer row.
router.post('/:id/signers/:signerId/sign-as-staff', async (req, res) => {
  try {
    const { signed_name } = req.body;
    if (!signed_name || !signed_name.trim()) return res.status(400).json({ error: 'Type your full name to sign.' });

    const { rows: [signer] } = await safeQuery(
      `SELECT * FROM signature_signers WHERE id = $1 AND signature_request_id = $2`,
      [req.params.signerId, req.params.id]
    );
    if (!signer) return res.status(404).json({ error: 'Signer not found on this request' });
    if (signer.staff_id !== req.staff.id) return res.status(403).json({ error: 'This signature line is not assigned to you' });
    if (signer.status !== 'pending') return res.status(400).json({ error: `You have already ${signer.status} this.` });

    await safeQuery(
      `UPDATE signature_signers SET status = 'signed', signed_name = $1, signed_at = NOW(), ip_address = $2, user_agent = $3 WHERE id = $4`,
      [signed_name.trim(), req.ip || null, (req.headers['user-agent'] || '').slice(0, 300), signer.id]
    );
    await maybeCompleteRequest(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[esignatures:sign-as-staff]', err);
    res.status(500).json({ error: 'Failed to record your signature' });
  }
});

router.post('/:id/void', requireRole('hr'), async (req, res) => {
  try {
    const { rows: [request] } = await safeQuery(
      `UPDATE signature_requests SET status = 'voided', voided_at = NOW(), voided_by = $1 WHERE id = $2 AND status != 'completed' RETURNING *`,
      [req.staff.id, req.params.id]
    );
    if (!request) return res.status(400).json({ error: 'Request not found, or already completed (completed requests cannot be voided)' });
    await logAction({ staffId: req.staff.id, action: 'signature_request.voided', entity: 'signature_requests', entityId: request.id, oldValue: { title: request.title } });
    res.json({ request });
  } catch (err) {
    console.error('[esignatures:void]', err);
    res.status(500).json({ error: 'Failed to void signature request' });
  }
});

module.exports = router;