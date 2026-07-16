// ─────────────────────────────────────────────────────────────────────────
// services/documentEngine.js
//
// The generic part of the document engine — nothing in here knows about
// "Offer Letter" or "NDA" specifically. Templates (body + fields) live in
// document_templates; this module renders any of them the same way:
//   1. validateFields()   — make sure required inputs were supplied
//   2. renderTemplate()   — {{placeholder}} substitution (same convention
//                           already used in automationEngine.js)
//   3. nextDocumentNumber() — ET-{year}-{DEPT}-{00001}, scoped per
//                           department per year, same LPAD(MAX+1) pattern
//                           already used for invoice_number in invoices.js
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { safeQuery } = require('../db/pool');

function renderTemplate(template, data) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val === undefined || val === null || val === '' ? '' : String(val);
  });
}

/**
 * @param {Array<{key:string,label:string,required:boolean}>} fields
 * @param {object} data
 * @returns {string[]} missing field labels (empty array = valid)
 */
function validateFields(fields, data) {
  const missing = [];
  for (const f of fields || []) {
    if (f.required && (data[f.key] === undefined || data[f.key] === null || data[f.key] === '')) {
      missing.push(f.label || f.key);
    }
  }
  return missing;
}

/**
 * Generates the next sequential document number for a department in the
 * current year, e.g. ET-2026-HR-00001. Must be called inside the same
 * transaction/request that inserts the generated_documents row to avoid a
 * race between two staff generating a document at the same instant —
 * callers should treat the UNIQUE constraint on document_number as the
 * real safety net (retry on conflict), same as invoices.js does implicitly.
 */
async function nextDocumentNumber(departmentCode) {
  const year = new Date().getFullYear();
  const prefix = `ET-${year}-${departmentCode}-`;
  const { rows: [{ next_num }] } = await safeQuery(
    `SELECT LPAD((COALESCE(MAX(SUBSTRING(document_number FROM '\\d+$')::int), 0) + 1)::text, 5, '0') AS next_num
     FROM generated_documents WHERE document_number LIKE $1 || '%'`,
    [prefix]
  );
  return `${prefix}${next_num}`;
}

/** Merges company_profile fields (as company_* keys) with submitted form data. */
function buildRenderData(companyProfile, formData) {
  return {
    company_name: companyProfile?.name || '',
    company_cin: companyProfile?.cin || '',
    company_gstin: companyProfile?.gstin || '',
    company_address: companyProfile?.registered_address || '',
    company_email: companyProfile?.email || '',
    company_website: companyProfile?.website || '',
    company_phone: companyProfile?.phone || '',
    ...formData,
  };
}

module.exports = { renderTemplate, validateFields, nextDocumentNumber, buildRenderData };
