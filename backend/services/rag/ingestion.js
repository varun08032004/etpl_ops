'use strict';

const crypto = require('crypto');
const { safeQuery, withTransaction } = require('../../db/pool');
const { chunkMarkdown, chunkPlainText, chunkJson, estimateTokens } = require('./chunking');
const { upsertDocument, findDocumentByHash, upsertChunks, deleteChunksForDocument, logIngestion } = require('./vectorStore');

function computeContentHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function extractTextFromDocumentDoc(doc) {
  const parts = [];
  if (doc.title) parts.push(`Title: ${doc.title}`);
  if (doc.doc_type) parts.push(`Type: ${doc.doc_type}`);
  if (doc.entity_type) parts.push(`Entity: ${doc.entity_type}`);
  if (doc.entity_id) parts.push(`Entity ID: ${doc.entity_id}`);
  if (doc.tags && doc.tags.length) parts.push(`Tags: ${doc.tags.join(', ')}`);
  if (doc.expiry_date) parts.push(`Expiry: ${doc.expiry_date}`);
  parts.push(`Content: [PDF document - text extraction not implemented]`);
  return parts.join('\n');
}

function extractTextFromGeneratedDoc(doc) {
  const parts = [];
  parts.push(`Document: ${doc.document_number}`);
  parts.push(`Template: ${doc.template_name || doc.template_code}`);
  parts.push(`Category: ${doc.category}`);
  parts.push(`Department: ${doc.department_code}`);
  parts.push(`Status: ${doc.status}`);
  parts.push(`Generated: ${doc.created_at}`);
  if (doc.data) {
    parts.push(`Data: ${JSON.stringify(doc.data, null, 2)}`);
  }
  return parts.join('\n');
}

function extractTextFromTemplate(template) {
  const parts = [];
  parts.push(`Template: ${template.name} (${template.code})`);
  parts.push(`Category: ${template.category}`);
  parts.push(`Department: ${template.department_code}`);
  if (template.title_on_page) parts.push(`Title: ${template.title_on_page}`);
  if (template.body) parts.push(`Body: ${template.body}`);
  if (template.fields && template.fields.length) {
    parts.push(`Fields: ${JSON.stringify(template.fields, null, 2)}`);
  }
  return parts.join('\n');
}

function extractTextFromComplianceSetting(setting) {
  return `Compliance Setting: ${setting.key}\nValue: ${setting.value}\nDescription: ${setting.description || 'N/A'}\nVerified: ${setting.verified_by ? 'Yes' : 'No'}`;
}

function extractTextFromAppSetting(setting) {
  return `App Setting: ${setting.key}\nValue: ${setting.value}\nType: ${typeof setting.value}`;
}

function extractTextFromTaxSlab(slab) {
  return `Tax Slab (${slab.regime} regime, FY ${slab.fiscal_year}): Income ₹${slab.income_from} to ${slab.income_to || '∞'} — Rate ${slab.rate_percent}%${slab.standard_deduction ? `, Standard Deduction ₹${slab.standard_deduction}` : ''}${slab.cess_percent ? `, Cess ${slab.cess_percent}%` : ''}`;
}

function extractTextFromPtSlab(slab) {
  return `Professional Tax Slab (${slab.state}): Gross ₹${slab.gross_from} to ${slab.gross_to || '∞'} — Monthly PT ₹${slab.monthly_amount}${slab.applies_in_february_override ? ' (Feb override)' : ''}`;
}

function extractTextFromCompanyProfile(profile) {
  const parts = [];
  parts.push(`Company Profile: ${profile.name}`);
  if (profile.cin) parts.push(`CIN: ${profile.cin}`);
  if (profile.gstin) parts.push(`GSTIN: ${profile.gstin}`);
  if (profile.registered_address) parts.push(`Registered Address: ${profile.registered_address}`);
  if (profile.email) parts.push(`Email: ${profile.email}`);
  if (profile.website) parts.push(`Website: ${profile.website}`);
  if (profile.phone) parts.push(`Phone: ${profile.phone}`);
  return parts.join('\n');
}

async function ingestDocumentTemplates() {
  console.log('[ingestion] Ingesting document_templates...');
  const { rows } = await safeQuery(`SELECT * FROM document_templates WHERE is_active = true`);
  let created = 0, updated = 0, skipped = 0;

  for (const template of rows) {
    const text = extractTextFromTemplate(template);
    const contentHash = computeContentHash(text);

    const existing = await findDocumentByHash(contentHash);
    if (existing) {
      skipped++;
      continue;
    }

    const document = await upsertDocument({
      sourceTable: 'document_templates',
      sourceId: template.id,
      documentName: `${template.name} (${template.code})`,
      departmentCode: template.department_code,
      roleRequired: template.category === 'hr' ? 'hr' : template.category === 'finance' ? 'finance' : null,
      isPublic: false,
      contentHash,
      version: template.version || 1,
    });

    const chunks = chunkMarkdown(text, { chunkSize: 512, chunkOverlap: 50 });
    const enrichedChunks = chunks.map((c, i) => ({
      ...c,
      metadata: {
        sourceTable: 'document_templates',
        sourceId: template.id,
        templateCode: template.code,
        templateCategory: template.category,
        departmentCode: template.department_code,
      },
    }));

    const result = await upsertChunks(document.id, enrichedChunks);
    created += result.created;
    updated += result.updated;
  }

  await logIngestion({ sourceTable: 'document_templates', status: 'success', chunksCreated: created, chunksUpdated: updated });
  console.log(`[ingestion] document_templates: ${rows.length} templates, ${created} chunks created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function ingestGeneratedDocuments() {
  console.log('[ingestion] Ingesting generated_documents...');
  const { rows } = await safeQuery(`
    SELECT gd.*, dt.name AS template_name, dt.code AS template_code
    FROM generated_documents gd
    LEFT JOIN document_templates dt ON dt.id = gd.template_id
    WHERE gd.status IN ('generated', 'approved')
  `);
  let created = 0, updated = 0, skipped = 0;

  for (const doc of rows) {
    const text = extractTextFromGeneratedDoc(doc);
    const contentHash = computeContentHash(text);

    const existing = await findDocumentByHash(contentHash);
    if (existing) {
      skipped++;
      continue;
    }

    const document = await upsertDocument({
      sourceTable: 'generated_documents',
      sourceId: doc.id,
      documentName: `${doc.template_name || doc.template_code} — ${doc.document_number}`,
      departmentCode: doc.department_code,
      roleRequired: doc.category === 'hr' ? 'hr' : doc.category === 'finance' ? 'finance' : null,
      isPublic: false,
      contentHash,
      version: doc.template_version || 1,
    });

    const chunks = chunkPlainText(text, { chunkSize: 512, chunkOverlap: 50 });
    const enrichedChunks = chunks.map((c, i) => ({
      ...c,
      metadata: {
        sourceTable: 'generated_documents',
        sourceId: doc.id,
        documentNumber: doc.document_number,
        templateCode: doc.template_code,
        templateCategory: doc.category,
        departmentCode: doc.department_code,
        status: doc.status,
      },
    }));

    const result = await upsertChunks(document.id, enrichedChunks);
    created += result.created;
    updated += result.updated;
  }

  await logIngestion({ sourceTable: 'generated_documents', status: 'success', chunksCreated: created, chunksUpdated: updated });
  console.log(`[ingestion] generated_documents: ${rows.length} docs, ${created} chunks created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function ingestDocuments() {
  console.log('[ingestion] Ingesting documents (metadata only - PDF extraction not implemented)...');
  const { rows } = await safeQuery(`SELECT * FROM documents WHERE is_current = true`);
  let created = 0, updated = 0, skipped = 0;

  for (const doc of rows) {
    const text = extractTextFromDocumentDoc(doc);
    const contentHash = computeContentHash(text);

    const existing = await findDocumentByHash(contentHash);
    if (existing) {
      skipped++;
      continue;
    }

    const isEmployeeDoc = doc.entity_type === 'employee';
    const document = await upsertDocument({
      sourceTable: 'documents',
      sourceId: doc.id,
      documentName: doc.title,
      departmentCode: null,
      roleRequired: isEmployeeDoc ? 'hr' : null,
      isPublic: !isEmployeeDoc,
      contentHash,
      version: doc.version || 1,
    });

    const chunks = chunkPlainText(text, { chunkSize: 512, chunkOverlap: 50 });
    const enrichedChunks = chunks.map((c, i) => ({
      ...c,
      metadata: {
        sourceTable: 'documents',
        sourceId: doc.id,
        docType: doc.doc_type,
        entityType: doc.entity_type,
        entityId: doc.entity_id ? String(doc.entity_id) : null,
        tags: doc.tags,
      },
    }));

    const result = await upsertChunks(document.id, enrichedChunks);
    created += result.created;
    updated += result.updated;
  }

  await logIngestion({ sourceTable: 'documents', status: 'success', chunksCreated: created, chunksUpdated: updated });
  console.log(`[ingestion] documents: ${rows.length} docs, ${created} chunks created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function ingestComplianceSettings() {
  console.log('[ingestion] Ingesting compliance_settings...');
  const { rows } = await safeQuery(`SELECT * FROM compliance_settings`);
  let created = 0, updated = 0, skipped = 0;

  for (const setting of rows) {
    const text = extractTextFromComplianceSetting(setting);
    const contentHash = computeContentHash(text);

    const existing = await findDocumentByHash(contentHash);
    if (existing) {
      skipped++;
      continue;
    }

    const document = await upsertDocument({
      sourceTable: 'compliance_settings',
      sourceId: setting.key,
      documentName: `Compliance: ${setting.key}`,
      departmentCode: null,
      roleRequired: 'finance',
      isPublic: false,
      contentHash,
      version: 1,
    });

    const chunks = chunkPlainText(text, { chunkSize: 512, chunkOverlap: 50 });
    const enrichedChunks = chunks.map((c, i) => ({
      ...c,
      metadata: {
        sourceTable: 'compliance_settings',
        sourceId: setting.key,
        settingKey: setting.key,
        verified: !!setting.verified_by,
      },
    }));

    const result = await upsertChunks(document.id, enrichedChunks);
    created += result.created;
    updated += result.updated;
  }

  await logIngestion({ sourceTable: 'compliance_settings', status: 'success', chunksCreated: created, chunksUpdated: updated });
  console.log(`[ingestion] compliance_settings: ${rows.length} settings, ${created} chunks created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function ingestAppSettings() {
  console.log('[ingestion] Ingesting app_settings...');
  const { rows: textRows } = await safeQuery(`SELECT * FROM app_settings`);
  const { rows: numRows } = await safeQuery(`SELECT * FROM app_settings_numeric`);
  const allSettings = [
    ...textRows.map(r => ({ ...r, value: r.value })),
    ...numRows.map(r => ({ ...r, value: Number(r.value) })),
  ];
  let created = 0, updated = 0, skipped = 0;

  for (const setting of allSettings) {
    const text = extractTextFromAppSetting(setting);
    const contentHash = computeContentHash(text);

    const existing = await findDocumentByHash(contentHash);
    if (existing) {
      skipped++;
      continue;
    }

    const document = await upsertDocument({
      sourceTable: 'app_settings',
      sourceId: require('crypto').createHash('sha256').update(`${setting.key}`).digest('hex').slice(0, 32),
      documentName: `App Setting: ${setting.key}`,
      departmentCode: null,
      roleRequired: 'finance',
      isPublic: false,
      contentHash,
      version: 1,
    });

    const chunks = chunkPlainText(text, { chunkSize: 512, chunkOverlap: 50 });
    const enrichedChunks = chunks.map((c, i) => ({
      ...c,
      metadata: {
        sourceTable: 'app_settings',
        settingKey: setting.key,
      },
    }));

    const result = await upsertChunks(document.id, enrichedChunks);
    created += result.created;
    updated += result.updated;
  }

  await logIngestion({ sourceTable: 'app_settings', status: 'success', chunksCreated: created, chunksUpdated: updated });
  console.log(`[ingestion] app_settings: ${allSettings.length} settings, ${created} chunks created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function ingestTaxSlabs() {
  console.log('[ingestion] Ingesting tax_slabs...');
  const { rows } = await safeQuery(`SELECT * FROM tax_slabs ORDER BY fiscal_year DESC, regime, income_from`);
  let created = 0, updated = 0, skipped = 0;

  for (const slab of rows) {
    const text = extractTextFromTaxSlab(slab);
    const contentHash = computeContentHash(text);

    const existing = await findDocumentByHash(contentHash);
    if (existing) {
      skipped++;
      continue;
    }

    const document = await upsertDocument({
      sourceTable: 'tax_slabs',
      sourceId: slab.id,
      documentName: `Tax Slab: ${slab.regime} regime FY ${slab.fiscal_year}`,
      departmentCode: null,
      roleRequired: 'finance',
      isPublic: false,
      contentHash,
      version: 1,
    });

    const chunks = chunkPlainText(text, { chunkSize: 512, chunkOverlap: 50 });
    const enrichedChunks = chunks.map((c, i) => ({
      ...c,
      metadata: {
        sourceTable: 'tax_slabs',
        sourceId: slab.id,
        regime: slab.regime,
        fiscalYear: slab.fiscal_year,
      },
    }));

    const result = await upsertChunks(document.id, enrichedChunks);
    created += result.created;
    updated += result.updated;
  }

  await logIngestion({ sourceTable: 'tax_slabs', status: 'success', chunksCreated: created, chunksUpdated: updated });
  console.log(`[ingestion] tax_slabs: ${rows.length} slabs, ${created} chunks created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function ingestPtSlabs() {
  console.log('[ingestion] Ingesting pt_slabs...');
  const { rows } = await safeQuery(`SELECT * FROM pt_slabs ORDER BY state, gross_from`);
  let created = 0, updated = 0, skipped = 0;

  for (const slab of rows) {
    const text = extractTextFromPtSlab(slab);
    const contentHash = computeContentHash(text);

    const existing = await findDocumentByHash(contentHash);
    if (existing) {
      skipped++;
      continue;
    }

    const document = await upsertDocument({
      sourceTable: 'pt_slabs',
      sourceId: slab.id,
      documentName: `PT Slab: ${slab.state}`,
      departmentCode: null,
      roleRequired: 'finance',
      isPublic: false,
      contentHash,
      version: 1,
    });

    const chunks = chunkPlainText(text, { chunkSize: 512, chunkOverlap: 50 });
    const enrichedChunks = chunks.map((c, i) => ({
      ...c,
      metadata: {
        sourceTable: 'pt_slabs',
        sourceId: slab.id,
        state: slab.state,
      },
    }));

    const result = await upsertChunks(document.id, enrichedChunks);
    created += result.created;
    updated += result.updated;
  }

  await logIngestion({ sourceTable: 'pt_slabs', status: 'success', chunksCreated: created, chunksUpdated: updated });
  console.log(`[ingestion] pt_slabs: ${rows.length} slabs, ${created} chunks created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

async function ingestCompanyProfile() {
  console.log('[ingestion] Ingesting company_profile...');
  const { rows } = await safeQuery(`SELECT * FROM company_profile ORDER BY updated_at DESC LIMIT 1`);
  if (!rows.length) {
    console.log('[ingestion] company_profile: no profile found');
    return { created: 0, updated: 0, skipped: 0 };
  }

  const profile = rows[0];
  const text = extractTextFromCompanyProfile(profile);
  const contentHash = computeContentHash(text);

  const existing = await findDocumentByHash(contentHash);
  if (existing) {
    console.log('[ingestion] company_profile: unchanged, skipped');
    return { created: 0, updated: 0, skipped: 1 };
  }

  const document = await upsertDocument({
    sourceTable: 'company_profile',
    sourceId: profile.id,
    documentName: 'Company Profile',
    departmentCode: null,
    roleRequired: null,
    isPublic: true,
    contentHash,
    version: 1,
  });

  const chunks = chunkPlainText(text, { chunkSize: 512, chunkOverlap: 50 });
  const enrichedChunks = chunks.map((c, i) => ({
    ...c,
    metadata: {
      sourceTable: 'company_profile',
      sourceId: profile.id,
    },
  }));

  const result = await upsertChunks(document.id, enrichedChunks);
  await logIngestion({ sourceTable: 'company_profile', status: 'success', chunksCreated: result.created, chunksUpdated: result.updated });
  console.log(`[ingestion] company_profile: ${result.created} chunks created, ${result.updated} updated`);
  return { created: result.created, updated: result.updated, skipped: 0 };
}

async function runFullIngestion() {
  console.log('[ingestion] Starting full RAG ingestion...');
  const startTime = Date.now();

  const results = {
    documentTemplates: await ingestDocumentTemplates(),
    generatedDocuments: await ingestGeneratedDocuments(),
    documents: await ingestDocuments(),
    complianceSettings: await ingestComplianceSettings(),
    appSettings: await ingestAppSettings(),
    taxSlabs: await ingestTaxSlabs(),
    ptSlabs: await ingestPtSlabs(),
    companyProfile: await ingestCompanyProfile(),
  };

  const totalCreated = Object.values(results).reduce((sum, r) => sum + r.created, 0);
  const totalUpdated = Object.values(results).reduce((sum, r) => sum + r.updated, 0);
  const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);

  console.log(`[ingestion] Complete in ${Date.now() - startTime}ms`);
  console.log(`[ingestion] Total: ${totalCreated} chunks created, ${totalUpdated} updated, ${totalSkipped} skipped`);

  return results;
}

async function ingestSingleSource(sourceTable, sourceId) {
  console.log(`[ingestion] Ingesting single source: ${sourceTable} ${sourceId || ''}`);

  switch (sourceTable) {
    case 'document_templates':
      return ingestDocumentTemplates();
    case 'generated_documents':
      return ingestGeneratedDocuments();
    case 'documents':
      return ingestDocuments();
    case 'compliance_settings':
      return ingestComplianceSettings();
    case 'app_settings':
      return ingestAppSettings();
    case 'tax_slabs':
      return ingestTaxSlabs();
    case 'pt_slabs':
      return ingestPtSlabs();
    case 'company_profile':
      return ingestCompanyProfile();
    default:
      throw new Error(`Unknown source table: ${sourceTable}`);
  }
}

module.exports = {
  runFullIngestion,
  ingestSingleSource,
  ingestDocumentTemplates,
  ingestGeneratedDocuments,
  ingestDocuments,
  ingestComplianceSettings,
  ingestAppSettings,
  ingestTaxSlabs,
  ingestPtSlabs,
  ingestCompanyProfile,
  computeContentHash,
  extractTextFromDocumentDoc,
  extractTextFromGeneratedDoc,
  extractTextFromTemplate,
  extractTextFromComplianceSetting,
  extractTextFromAppSetting,
  extractTextFromTaxSlab,
  extractTextFromPtSlab,
  extractTextFromCompanyProfile,
};