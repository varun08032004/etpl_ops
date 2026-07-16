'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Public (unauthenticated) verification endpoint. This is what each
// document's QR code links to: confirms a document with this number was
// genuinely issued by the system, without leaking its actual contents
// (salary, agreement text, personal data) to whoever scans the code.
// Deliberately mounted as its own router (not under document-engine.js,
// which requires authenticate) so it stays outside the auth wall.
// ─────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');

router.get('/:documentNumber', async (req, res) => {
  try {
    const { rows: [doc] } = await safeQuery(
      `SELECT gd.document_number, gd.status, gd.version, gd.created_at, dt.name AS document_type
       FROM generated_documents gd JOIN document_templates dt ON dt.id = gd.template_id
       WHERE gd.document_number = $1`,
      [req.params.documentNumber]
    );
    if (!doc) return res.status(404).json({ valid: false, message: 'No document with this number was found in EtherTrack Ops.' });
    if (doc.status === 'void') {
      return res.json({ valid: false, message: 'This document has been voided and is no longer valid.', document_number: doc.document_number });
    }
    res.json({
      valid: true,
      document_number: doc.document_number,
      document_type: doc.document_type,
      version: doc.version,
      status: doc.status,
      issued_on: doc.created_at,
    });
  } catch (err) {
    console.error('[document-verify]', err);
    res.status(500).json({ valid: false, message: 'Verification temporarily unavailable' });
  }
});

module.exports = router;
