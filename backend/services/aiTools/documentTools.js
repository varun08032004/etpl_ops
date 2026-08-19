'use strict';

const { safeQuery, withTransaction } = require('../../db/pool');
const storage = require('../storage');
const { logAction } = require('../auditLog');
const { renderTemplate, renderCustomBody, validateFields, nextDocumentNumber, buildRenderData } = require('../documentEngine');
const { buildDocumentPdf } = require('../pdfBuilder');
const { fetchImageBuffer, sanitizeImageForPdf } = require('../documentEngineUtils');

const documentTools = [
  {
    name: 'list_documents',
    description: 'List documents with filters',
    category: 'documents',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'hr', 'finance'],
    allowedDepartments: [],
    parameters: {
      entity_type: { type: 'string', required: false },
      entity_id: { type: 'string', required: false },
      doc_type: { type: 'string', required: false },
      current_only: { type: 'boolean', required: false },
    },
    execute: async (params, user) => {
      const privileged = ['owner', 'admin', 'hr', 'finance'].includes(user.role);
      if (params.entity_type === 'employee' && params.entity_id && !privileged && params.entity_id !== user.staff.employee_id) {
        throw new Error('You can only view your own documents');
      }
      const effectiveEntityId = (params.entity_type === 'employee' && !privileged && !params.entity_id) ? user.staff.employee_id : params.entity_id;

      const conditions = [];
      const queryParams = [];
      if (params.entity_type) { queryParams.push(params.entity_type); conditions.push(`entity_type = $${queryParams.length}`); }
      if (effectiveEntityId) { queryParams.push(effectiveEntityId); conditions.push(`entity_id = $${queryParams.length}`); }
      if (params.doc_type) { queryParams.push(params.doc_type); conditions.push(`doc_type = $${queryParams.length}`); }
      if (params.current_only !== false) conditions.push(`is_current = true`);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const { rows } = await safeQuery(
        `SELECT d.*, sa.email AS uploaded_by_email FROM documents d LEFT JOIN staff_accounts sa ON sa.id = d.uploaded_by ${where} ORDER BY d.created_at DESC`,
        queryParams
      );
      return { documents: rows };
    },
  },

  {
    name: 'get_document',
    description: 'Get document metadata',
    category: 'documents',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'hr', 'finance'],
    allowedDepartments: [],
    parameters: {
      document_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [doc] } = await safeQuery(`SELECT d.*, sa.email AS uploaded_by_email FROM documents d LEFT JOIN staff_accounts sa ON sa.id = d.uploaded_by WHERE d.id = $1`, [params.document_id]);
      if (!doc) throw new Error('Document not found');

      const privileged = ['owner', 'admin', 'hr', 'finance'].includes(user.role);
      if (doc.entity_type === 'employee' && doc.entity_id && !privileged && doc.entity_id !== user.staff.employee_id) {
        throw new Error('You can only view your own documents');
      }
      return { document: doc };
    },
  },

  {
    name: 'upload_document',
    description: 'Upload a new document',
    category: 'documents',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['owner', 'admin', 'hr', 'finance'],
    allowedDepartments: [],
    parameters: {
      title: { type: 'string', required: true },
      doc_type: { type: 'string', required: true },
      entity_type: { type: 'string', required: false },
      entity_id: { type: 'string', required: false },
      expiry_date: { type: 'string', required: false },
      tags: { type: 'array', required: false },
      allow_duplicate: { type: 'boolean', required: false },
      file_content_base64: { type: 'string', required: true, description: 'Base64 encoded file content' },
      file_name: { type: 'string', required: true },
      mime_type: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const effectiveEntityType = params.entity_type || 'company';
      if (params.allow_duplicate !== true) {
        const { rows: [existing] } = await safeQuery(
          `SELECT d.*, sa.email AS uploaded_by_email FROM documents d LEFT JOIN staff_accounts sa ON sa.id = d.uploaded_by
           WHERE d.is_current = true AND d.entity_type = $1 AND (d.entity_id = $2 OR (d.entity_id IS NULL AND $2::uuid IS NULL)) AND LOWER(d.title) = LOWER($3) LIMIT 1`,
          [effectiveEntityType, params.entity_id || null, params.title]
        );
        if (existing) throw new Error(`Document "${existing.title}" already exists`);
      }

      const buffer = Buffer.from(params.file_content_base64, 'base64');
      const timestamp = Date.now();
      const cleanName = params.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const folder = params.entity_type && params.entity_id ? `${params.entity_type}/${params.entity_id}` : (params.entity_type || 'company');
      const storagePath = `${folder}/${timestamp}-${cleanName}`;

      await storage.uploadFile(storagePath, buffer, params.mime_type);

      const parsedTags = params.tags ? (Array.isArray(params.tags) ? params.tags : params.tags.split(',').map((t) => t.trim())) : null;

      const { rows: [doc] } = await safeQuery(
        `INSERT INTO documents (title, doc_type, entity_type, entity_id, storage_path, file_name, file_size_bytes, mime_type, expiry_date, tags, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [params.title, params.doc_type, effectiveEntityType, params.entity_id || null, storagePath, params.file_name,
         buffer.length, params.mime_type, params.expiry_date || null, parsedTags, user.staff.id]
      );
      return { document: doc, message: 'Document uploaded successfully' };
    },
  },

  {
    name: 'generate_document',
    description: 'Generate a document from a template',
    category: 'documents',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['owner', 'admin', 'hr', 'finance'],
    allowedDepartments: [],
    parameters: {
      template_code: { type: 'string', required: true },
      data: { type: 'object', required: true },
      entity_type: { type: 'string', required: false },
      entity_id: { type: 'string', required: false },
      send_email: { type: 'boolean', required: false },
      email_to: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const { rows: [template] } = await safeQuery(`SELECT * FROM document_templates WHERE code = $1 AND is_active = true`, [params.template_code]);
      if (!template) throw new Error('Template not found or inactive');

      // Auto-sequence fields
      for (const f of template.fields || []) {
        if (!f.auto_sequence) continue;
        const { rows: [{ count }] } = await safeQuery(`SELECT COUNT(*) FROM generated_documents WHERE template_id = $1`, [template.id]);
        const next = Number(count) + 1;
        const padded = String(next).padStart(f.sequence_pad || 4, '0');
        params.data[f.key] = `${f.sequence_prefix || ''}${padded}`;
      }

      const missing = validateFields(template.fields, params.data);
      if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const companyProfile = await (async () => {
        const { rows: [profile] } = await safeQuery(`SELECT * FROM company_profile ORDER BY updated_at DESC LIMIT 1`);
        return profile;
      })();
      if (!companyProfile) throw new Error('Company profile not configured');

      const renderData = buildRenderData(companyProfile, params.data, template.fields);
      const renderedBody = (params.data.custom_body && params.data.custom_body.trim())
        ? renderCustomBody(params.data.custom_body, renderData)
        : renderTemplate(template.body, renderData);

      let documentNumber, inserted;
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        documentNumber = await nextDocumentNumber(template.department_code);
        const generatedAt = new Date();

        const [logoBufferRaw, sealBufferRaw, signatureBufferRaw] = await Promise.all([
          fetchImageBuffer(companyProfile.logo_url),
          template.requires_seal ? fetchImageBuffer(companyProfile.seal_image_url) : null,
          template.requires_signature ? fetchImageBuffer(companyProfile.signature_image_url) : null,
        ]);
        const [logoBuffer, sealBuffer, signatureBuffer] = await Promise.all([
          sanitizeImageForPdf(logoBufferRaw, 'logo'),
          sanitizeImageForPdf(sealBufferRaw, 'seal'),
          sanitizeImageForPdf(signatureBufferRaw, 'signature'),
        ]);

        const pdfBuffer = await buildDocumentPdf({
          companyProfile: companyProfile,
          template: template,
          renderedBody: renderedBody,
          data: params.data,
          generatedDoc: {
            document_number: documentNumber,
            version: 1,
            status: 'generated',
            date_str: generatedAt.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
            generated_by_name: user.staff.email,
          },
          images: { logoBuffer, sealBuffer, signatureBuffer },
        });

        const fileName = `${documentNumber}.pdf`;
        const storagePath = `generated/${template.department_code}/${new Date().getFullYear()}/${fileName}`;

        try {
          await storage.uploadFile(storagePath, pdfBuffer, 'application/pdf');
          ({ rows: [inserted] } = await safeQuery(
            `INSERT INTO generated_documents (template_id, template_version, document_number, category, department_code, entity_type, entity_id, data, storage_path, file_name, generated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [template.id, template.version, documentNumber, template.category, template.department_code, params.entity_type || null, params.entity_id || null, JSON.stringify(params.data), storagePath, fileName, user.staff.id]
          ));
        } catch (err) {
          if (err.code === '23505') continue;
          throw err;
        }
      }

      if (!inserted) throw new Error('Could not allocate document number');

      let emailResult = null;
      if (params.send_email && params.email_to) {
        const emailService = require('../emailService');
        emailResult = await emailService.sendMail({
          to: params.email_to,
          subject: `${template.name} — ${inserted.document_number}`,
          text: `Please find attached your ${template.name} (${inserted.document_number}).`,
          attachments: [{ filename: inserted.file_name, content: pdfBuffer }],
        });
        if (emailResult.sent) {
          await safeQuery(`UPDATE generated_documents SET emailed_to = $1, emailed_at = NOW() WHERE id = $2`, [params.email_to, inserted.id]);
        }
      }

      await logAction({ staffId: user.staff.id, action: 'document.generated', entity: 'generated_documents', entityId: inserted.id, newValue: { document_number: inserted.document_number, template: template.code } });
      return { document: inserted, email: emailResult, message: `Document ${inserted.document_number} generated successfully` };
    },
  },

  {
    name: 'list_generated_docs',
    description: 'List generated documents',
    category: 'documents',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'hr', 'finance'],
    allowedDepartments: [],
    parameters: {
      category: { type: 'string', required: false },
      department_code: { type: 'string', required: false },
      entity_type: { type: 'string', required: false },
      entity_id: { type: 'string', required: false },
      status: { type: 'string', required: false },
      template_code: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const conditions = [];
      const queryParams = [];
      if (params.category) { queryParams.push(params.category); conditions.push(`gd.category = $${queryParams.length}`); }
      if (params.department_code) { queryParams.push(params.department_code); conditions.push(`gd.department_code = $${queryParams.length}`); }
      if (params.entity_type) { queryParams.push(params.entity_type); conditions.push(`gd.entity_type = $${queryParams.length}`); }
      if (params.entity_id) { queryParams.push(params.entity_id); conditions.push(`gd.entity_id = $${queryParams.length}`); }
      if (params.status) { queryParams.push(params.status); conditions.push(`gd.status = $${queryParams.length}`); }
      if (params.template_code) { queryParams.push(params.template_code); conditions.push(`dt.code = $${queryParams.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await safeQuery(
        `SELECT gd.*, dt.name AS template_name, dt.code AS template_code, sa.email AS generated_by_email
         FROM generated_documents gd
         JOIN document_templates dt ON dt.id = gd.template_id
         LEFT JOIN staff_accounts sa ON sa.id = gd.generated_by
         ${where} ORDER BY gd.created_at DESC`,
        queryParams
      );
      return { documents: rows };
    },
  },

  {
    name: 'approve_generated_doc',
    description: 'Approve a generated document',
    category: 'documents',
    readOnly: false,
    requiresConfirmation: true,
    destructive: false,
    allowedRoles: ['admin', 'hr', 'finance'],
    allowedDepartments: [],
    parameters: {
      document_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [updated] } = await safeQuery(
        `UPDATE generated_documents SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2 RETURNING *`,
        [user.staff.id, params.document_id]
      );
      if (!updated) throw new Error('Document not found');

      // Mirror to documents table
      try {
        const { rows: [alreadyMirrored] } = await safeQuery(`SELECT id FROM documents WHERE storage_path = $1 LIMIT 1`, [updated.storage_path]);
        const { rows: [template] } = await safeQuery(`SELECT * FROM document_templates WHERE id = $1`, [updated.template_id]);
        if (template && !alreadyMirrored) {
          await safeQuery(
            `INSERT INTO documents (title, doc_type, entity_type, entity_id, storage_path, file_name, file_size_bytes, mime_type, uploaded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              `${template.name} — ${updated.document_number}`,
              (() => { const map = { OFFER_LETTER: 'offer_letter', NDA: 'nda', BOARD_RESOLUTION: 'board_resolution', SHARE_CERTIFICATE: 'certificate', EMPLOYMENT_AGREEMENT: 'contract', INTERNSHIP_AGREEMENT: 'contract', IP_ASSIGNMENT_AGREEMENT: 'contract', VENDOR_AGREEMENT: 'contract', CUSTOMER_SERVICE_AGREEMENT: 'contract' }; return map[template.code] || 'other'; })(),
              updated.entity_type || 'company',
              updated.entity_id || null,
              updated.storage_path, updated.file_name, null, 'application/pdf', updated.generated_by,
            ]
          );
        }
      } catch (linkErr) {
        console.warn('[approve_generated_doc] mirror failed:', linkErr.message);
      }

      await logAction({ staffId: user.staff.id, action: 'document.approved', entity: 'generated_documents', entityId: updated.id });
      return { document: updated, message: 'Document approved and mirrored to Documents' };
    },
  },

  {
    name: 'void_generated_doc',
    description: 'Void a generated document',
    category: 'documents',
    readOnly: false,
    requiresConfirmation: true,
    destructive: true,
    allowedRoles: ['admin', 'hr', 'finance'],
    allowedDepartments: [],
    parameters: {
      document_id: { type: 'string', required: true },
      reason: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [updated] } = await safeQuery(
        `UPDATE generated_documents SET status = 'void', void_reason = $1, voided_by = $2, voided_at = NOW() WHERE id = $3 RETURNING *`,
        [params.reason, user.staff.id, params.document_id]
      );
      if (!updated) throw new Error('Document not found');
      await logAction({ staffId: user.staff.id, action: 'document.voided', entity: 'generated_documents', entityId: updated.id, newValue: { reason: params.reason } });
      return { document: updated, message: 'Document voided' };
    },
  },
];

module.exports = documentTools;