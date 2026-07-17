// ─────────────────────────────────────────────────────────────────────────
// services/documentEngine.js
//
// The generic part of the document engine — nothing in here knows about
// "Offer Letter" or "NDA" specifically. Templates (body + fields) live in
// document_templates; this module renders any of them the same way:
//   1. validateFields()     — make sure required inputs were supplied
//   2. renderTemplate()     — {{placeholder}} substitution (same convention
//                             already used in automationEngine.js)
//   3. renderCustomBody()   — same substitution, but for a freeform body a
//                             staff member typed in instead of the template
//                             text (see routes/document-engine.js "generate")
//   4. nextDocumentNumber() — ET-{year}-{DEPT}-{00001}, scoped per
//                             department per year, same LPAD(MAX+1) pattern
//                             already used for invoice_number in invoices.js
//
// normalizeLineEndings() strips stray \r characters. Windows-edited files
// (or copy/paste from some editors) leave \r\n instead of \n; PDFKit only
// treats \n as a line break and draws the leftover \r as a stray glyph
// ("Ð") — see services/pdfBuilder.js for the full explanation. Doing the
// normalization here too (not just in pdfBuilder) means any other consumer
// of rendered template text (email bodies, previews, etc.) is safe as well.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { safeQuery } = require('../db/pool');

function normalizeLineEndings(str) {
  if (!str) return '';
  return String(str).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Same heuristic + formatting pdfBuilder.js uses for the summary box —
// duplicated here (rather than imported) to keep this module dependency-
// free of pdfkit/qrcode. Keeps inline mentions like "₹{{salary}}" inside a
// template's body text consistent with how the same figure shows up in the
// summary box: Indian comma grouping plus a Lacs/Crore suffix.
const AMOUNT_KEY_PATTERN = /amount|salary|stipend|ctc|price|fee|budget/i;

function formatIndianAmount(n) {
  const formatted = `\u20B9${n.toLocaleString('en-IN')}`;
  if (n >= 10000000) return `${formatted} (${(n / 10000000).toFixed(2)} Cr)`;
  if (n >= 100000) return `${formatted} (${(n / 100000).toFixed(2)} L)`;
  return formatted;
}

// Returns a shallow copy of formData with amount-like keys reformatted.
// Accepts values the admin typed with commas already in them (e.g.
// "36,00,000") by stripping non-digit characters before re-parsing.
function formatAmountFields(formData) {
  const out = { ...formData };
  for (const key of Object.keys(out)) {
    if (!AMOUNT_KEY_PATTERN.test(key)) continue;
    const raw = out[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(String(raw).replace(/,/g, ''));
    if (!isNaN(n)) out[key] = formatIndianAmount(n);
  }
  return out;
}

function substitutePlaceholders(template, data) {
  if (!template) return '';
  return normalizeLineEndings(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val === undefined || val === null || val === '' ? '' : normalizeLineEndings(String(val));
  });
}

function renderTemplate(template, data) {
  return substitutePlaceholders(template, data);
}

/**
 * Renders a staff-authored freeform body (the "write your own letter" box
 * in the generate dialog) with the same {{company_name}} / {{field_key}}
 * substitution as a stored template, so custom letters can still reference
 * company details and submitted field values.
 */
function renderCustomBody(customBodyText, data) {
  return substitutePlaceholders(customBodyText, data);
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

/**
 * Returns the distinct department codes already in use across active
 * templates — used to power a dropdown (instead of free text) when
 * creating a new template, so departments stay consistent (HR, LGL, etc.)
 * rather than accumulating typo'd variants over time.
 */
async function listDepartmentCodes() {
  const { rows } = await safeQuery(
    `SELECT DISTINCT department_code FROM document_templates WHERE is_active = true ORDER BY department_code`
  );
  return rows.map((r) => r.department_code);
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
    ...formatAmountFields(formData),
  };
}

module.exports = {
  renderTemplate,
  renderCustomBody,
  validateFields,
  nextDocumentNumber,
  listDepartmentCodes,
  buildRenderData,
  normalizeLineEndings,
};