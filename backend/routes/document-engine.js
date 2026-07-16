'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const storage = require('../services/storage');
const auditLog = require('../services/auditLog');
const emailService = require('../services/emailService');
const { renderTemplate, validateFields, nextDocumentNumber, buildRenderData } = require('../services/documentEngine');
const { buildDocumentPdf } = require('../services/pdfBuilder');

router.use(authenticate);

async function getCompanyProfile() {
  const { rows: [profile] } = await safeQuery(`SELECT * FROM company_profile ORDER BY updated_at DESC LIMIT 1`);
  return profile || null;
}

// Resolves a company_profile image field (logo/seal/signature) to a Buffer.
// Expects a plain https URL (a public Supabase storage URL, or any CDN link) —
// keeps this module free of bucket-path assumptions. Never throws: a missing
// or unreachable image just means the PDF falls back to its vector placeholder.
async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn('[document-engine] could not fetch image', url, err.message);
    return null;
  }
}

// ── company profile (letterhead settings) ───────────────────────────────────
router.get('/company-profile', async (req, res) => {
  try {
    const profile = await getCompanyProfile();
    res.json({ profile });
  } catch (err) {
    console.error('[document-engine:company-profile:get]', err);
    res.status(500).json({ error: 'Failed to fetch company profile' });
  }
});

router.put('/company-profile', requireRole('admin'), async (req, res) => {
  try {
    const existing = await getCompanyProfile();
    const f = req.body;
    const fields = ['name', 'cin', 'gstin', 'registered_address', 'email', 'website', 'phone',
      'logo_url', 'seal_image_url', 'default_signatory_name', 'default_signatory_title',
      'signature_image_url', 'verification_base_url'];
    let profile;
    if (existing) {
      const sets = fields.map((k, i) => `${k} = COALESCE($${i + 1}, ${k})`).join(', ');
      ({ rows: [profile] } = await safeQuery(
        `UPDATE company_profile SET ${sets} WHERE id = $${fields.length + 1} RETURNING *`,
        [...fields.map((k) => f[k]), existing.id]
      ));
    } else {
      const cols = fields.join(', ');
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      ({ rows: [profile] } = await safeQuery(
        `INSERT INTO company_profile (${cols}) VALUES (${placeholders}) RETURNING *`,
        fields.map((k) => f[k])
      ));
    }
    await auditLog.logAction({ staffId: req.staff.id, action: 'company_profile.updated', entity: 'company_profile', entityId: profile.id });
    res.json({ profile });
  } catch (err) {
    console.error('[document-engine:company-profile:put]', err);
    res.status(500).json({ error: 'Failed to update company profile' });
  }
});

// ── generate a document ──────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { template_code, data, entity_type, entity_id, send_email, email_to } = req.body;
    if (!template_code || !data) return res.status(400).json({ error: 'template_code and data are required' });

    const { rows: [template] } = await safeQuery(
      `SELECT * FROM document_templates WHERE code = $1 AND is_active = true`, [template_code]
    );
    if (!template) return res.status(404).json({ error: 'Template not found or inactive' });

    const missing = validateFields(template.fields, data);
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });

    const companyProfile = await getCompanyProfile();
    if (!companyProfile) return res.status(500).json({ error: 'Company profile is not configured yet — set it up under Admin first' });

    const renderData = buildRenderData(companyProfile, data);
    const renderedBody = renderTemplate(template.body, renderData);

    // Retry a couple of times on the (rare) unique-constraint race between
    // two staff generating in the same department at the same instant.
    let documentNumber, inserted;
    for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
      documentNumber = await nextDocumentNumber(template.department_code);
      const generatedAt = new Date();

      const [logoBuffer, sealBuffer, signatureBuffer] = await Promise.all([
        fetchImageBuffer(companyProfile.logo_url),
        template.requires_seal ? fetchImageBuffer(companyProfile.seal_image_url) : null,
        template.requires_signature ? fetchImageBuffer(companyProfile.signature_image_url) : null,
      ]);

      const pdfBuffer = await buildDocumentPdf({
        companyProfile,
        template,
        renderedBody,
        generatedDoc: {
          document_number: documentNumber,
          version: 1,
          status: 'generated',
          date_str: generatedAt.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
          generated_by_name: req.staff.email,
        },
        images: { logoBuffer, sealBuffer, signatureBuffer },
      });

      const fileName = `${documentNumber}.pdf`;
      const storagePath = `generated/${template.department_code}/${new Date().getFullYear()}/${fileName}`;

      try {
        await storage.uploadFile(storagePath, pdfBuffer, 'application/pdf');
        ({ rows: [inserted] } = await safeQuery(
          `INSERT INTO generated_documents
             (template_id, template_version, document_number, category, department_code, entity_type, entity_id, data, storage_path, file_name, generated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [template.id, template.version, documentNumber, template.category, template.department_code,
           entity_type || null, entity_id || null, JSON.stringify(data), storagePath, fileName, req.staff.id]
        ));
        req._pdfBuffer = pdfBuffer; // stash for optional immediate email below
      } catch (err) {
        if (err.code === '23505') continue; // document_number collision — retry with a fresh number
        throw err;
      }
    }
    if (!inserted) return res.status(500).json({ error: 'Could not allocate a document number after several attempts — please retry' });

    let emailResult = null;
    if (send_email && email_to) {
      emailResult = await emailService.sendMail({
        to: email_to,
        subject: `${template.name} — ${inserted.document_number}`,
        text: `Please find attached your ${template.name} (${inserted.document_number}).`,
        attachments: [{ filename: inserted.file_name, content: req._pdfBuffer }],
      });
      if (emailResult.sent) {
        await safeQuery(`UPDATE generated_documents SET emailed_to = $1, emailed_at = NOW() WHERE id = $2`, [email_to, inserted.id]);
      }
    }

    await auditLog.logAction({ staffId: req.staff.id, action: 'document.generated', entity: 'generated_documents', entityId: inserted.id, newValue: { document_number: inserted.document_number, template: template.code } });

    res.status(201).json({ document: inserted, email: emailResult });
  } catch (err) {
    console.error('[document-engine:generate]', err);
    res.status(500).json({ error: err.message || 'Failed to generate document' });
  }
});

// ── list generated documents ─────────────────────────────────────────────────
router.get('/generated', async (req, res) => {
  try {
    const { category, department_code, entity_type, entity_id, status, template_code } = req.query;
    const conditions = [];
    const params = [];
    if (category) { params.push(category); conditions.push(`gd.category = $${params.length}`); }
    if (department_code) { params.push(department_code); conditions.push(`gd.department_code = $${params.length}`); }
    if (entity_type) { params.push(entity_type); conditions.push(`gd.entity_type = $${params.length}`); }
    if (entity_id) { params.push(entity_id); conditions.push(`gd.entity_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`gd.status = $${params.length}`); }
    if (template_code) { params.push(template_code); conditions.push(`dt.code = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT gd.*, dt.name AS template_name, dt.code AS template_code, sa.email AS generated_by_email
       FROM generated_documents gd
       JOIN document_templates dt ON dt.id = gd.template_id
       LEFT JOIN staff_accounts sa ON sa.id = gd.generated_by
       ${where} ORDER BY gd.created_at DESC`,
      params
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('[document-engine:list]', err);
    res.status(500).json({ error: 'Failed to fetch generated documents' });
  }
});

// ── download link for a generated document ──────────────────────────────────
router.get('/generated/:id/download', async (req, res) => {
  try {
    const { rows: [doc] } = await safeQuery(`SELECT * FROM generated_documents WHERE id = $1`, [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const url = await storage.getSignedUrl(doc.storage_path, 300);
    res.json({ url, fileName: doc.file_name });
  } catch (err) {
    console.error('[document-engine:download]', err);
    res.status(500).json({ error: err.message || 'Failed to generate download link' });
  }
});

// ── approve a generated document (e.g. HR/finance sign-off before it's sent) ─
router.post('/generated/:id/approve', requireRole('admin', 'hr', 'finance'), async (req, res) => {
  try {
    const { rows: [updated] } = await safeQuery(
      `UPDATE generated_documents SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2 RETURNING *`,
      [req.staff.id, req.params.id]
    );
    if (!updated) return res.status(404).json({ error: 'Document not found' });
    await auditLog.logAction({ staffId: req.staff.id, action: 'document.approved', entity: 'generated_documents', entityId: updated.id });
    res.json({ document: updated });
  } catch (err) {
    console.error('[document-engine:approve]', err);
    res.status(500).json({ error: 'Failed to approve document' });
  }
});

// ── void a generated document (e.g. it was generated by mistake) ───────────
router.post('/generated/:id/void', requireRole('admin', 'hr', 'finance'), async (req, res) => {
  try {
    const { rows: [updated] } = await safeQuery(
      `UPDATE generated_documents SET status = 'void' WHERE id = $1 RETURNING *`, [req.params.id]
    );
    if (!updated) return res.status(404).json({ error: 'Document not found' });
    await auditLog.logAction({ staffId: req.staff.id, action: 'document.voided', entity: 'generated_documents', entityId: updated.id });
    res.json({ document: updated });
  } catch (err) {
    console.error('[document-engine:void]', err);
    res.status(500).json({ error: 'Failed to void document' });
  }
});

module.exports = router;
