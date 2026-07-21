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
  // No leading ₹ here — template bodies already write ₹{{salary}} etc.
  // literally in their wording, so adding it here too doubled up the
  // symbol (₹₹36,00,000). This just handles the Indian comma grouping
  // and Lacs/Crore suffix; the ₹ comes from the template text itself.
  const formatted = n.toLocaleString('en-IN');
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

// Used only when building a full sentence (e.g. the compensation clause
// below) — unlike formatAmountFields above, this DOES need to include ₹
// itself since there's no surrounding template text supplying it.
function formatIndianAmountWithSymbol(n) {
  const formatted = `\u20B9${n.toLocaleString('en-IN')}`;
  if (n >= 10000000) return `${formatted} (${(n / 10000000).toFixed(2)} Cr)`;
  if (n >= 100000) return `${formatted} (${(n / 100000).toFixed(2)} L)`;
  return formatted;
}

/**
 * Builds the one line of an offer letter that genuinely needs to branch —
 * what someone is actually paid depends on whether they're Full Time,
 * Contract Based, a Paid Intern, or an Unpaid Intern, and template bodies
 * can't do if/else on their own. Computing it here keeps that logic in one
 * place instead of needing four near-duplicate templates.
 */
function buildCompensationClause(data) {
  const type = data.employee_type;
  if (type === 'Intern (Unpaid)') {
    return 'This is an unpaid internship position; no monetary compensation is applicable for the duration of the internship.';
  }
  if (type === 'Intern (Paid)') {
    const n = Number(String(data.stipend || '').replace(/,/g, ''));
    if (!isNaN(n) && n > 0) return `You will be paid a monthly stipend of ${formatIndianAmountWithSymbol(n)}.`;
    return 'Stipend details will be confirmed separately.';
  }
  // Full Time / Contract Based (or anything else — safe default)
  const n = Number(String(data.salary || '').replace(/,/g, ''));
  if (!isNaN(n) && n > 0) return `Your annual CTC will be ${formatIndianAmountWithSymbol(n)}.`;
  return 'Compensation details will be confirmed separately.';
}

function formatDateNicely(value) {
  if (!value) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // not a date-like string, leave as-is
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Reformats every field of type "date" from the raw ISO string an HTML date
 * input submits (e.g. "2026-07-13") into "13 July 2026" — the form the
 * template body actually shows once substituted. Needs the template's
 * fields[] to know WHICH keys are dates (a plain string like "2026-07-13"
 * is otherwise indistinguishable from any other text).
 */
function formatDateFields(fields, formData) {
  const out = { ...formData };
  for (const f of fields || []) {
    if (f.type === 'date' && out[f.key]) out[f.key] = formatDateNicely(out[f.key]);
  }
  return out;
}

// Converts an integer into Indian-English number words (thousand/lakh/crore
// grouping, not the Western million/billion grouping) — e.g. 90000 ->
// "Ninety Thousand", 3600000 -> "Thirty-Six Lakh". Used for the "Rupees ...
// Only" wording on legal documents like a Share Certificate. Handles 0 to
// just under 100 crore, which comfortably covers anything a company this
// size would ever need on a certificate.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}
function threeDigitWords(n) {
  const h = Math.floor(n / 100), r = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(twoDigitWords(r));
  return parts.join(' ') || '';
}
function numberToIndianWords(n) {
  n = Math.round(n);
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  const parts = [];
  if (crore) parts.push(`${twoDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitWords(hundred));
  return parts.join(' ');
}

/**
 * Builds the "aggregating to ₹90,000 (Rupees Ninety Thousand Only), fully
 * paid-up." line for a Share Certificate — computed from
 * number_of_shares × face_value so the admin never has to calculate or
 * type it themselves.
 */
function buildShareCapitalClause(data) {
  const shares = Number(data.number_of_shares);
  const faceValue = Number(String(data.face_value || '').replace(/,/g, ''));
  if (!shares || !faceValue) return '';
  const total = shares * faceValue;
  return `aggregating to ${formatIndianAmountWithSymbol(total)} (Rupees ${numberToIndianWords(total)} Only), fully paid-up.`;
}

/**
 * Auto-numbers a textarea's lines — "1. First item\n2. Second item\n...".
 * Used for Agenda so an admin just types one item per line without having
 * to number them by hand. Blank lines are dropped (so paragraph spacing in
 * the textarea doesn't throw the numbering off), and lines that already
 * start with a number (e.g. someone pastes an already-numbered list) are
 * left alone rather than double-numbered.
 */
function numberLines(text) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let n = 0;
  return lines.map((line) => {
    if (/^\d+[.)]\s/.test(line)) return line; // already numbered — leave as-is
    n += 1;
    return `${n}. ${line}`;
  }).join('\n');
}

/**
 * Merges the pasted resolution clause with the standard closing
 * authorization boilerplate into ONE piece of text, so the whole thing —
 * including the "any Director or Company Secretary may sign..." closing —
 * gets drawn inside the same highlighted box. Previously the boilerplate
 * lived in the template body AFTER the %%BOX:...%% marker, as plain text —
 * which looked like the resolution's own ending had "fallen out" of the
 * box with no visual boundary explaining why.
 */
function buildResolutionTextFull(data) {
  const pasted = (data.resolution_text || '').trim();
  const closing = 'RESOLVED FURTHER THAT any Director or the Company Secretary of the Company be and is hereby severally authorised to sign, execute, and do all acts, deeds and things necessary to give effect to this Resolution.';
  return pasted ? `${pasted}\n\n${closing}` : closing;
}

/**
 * Omits the "IN ATTENDANCE:" section entirely when nobody outside the
 * board attended, rather than showing an empty or "None" line under a
 * heading — cleaner for the common case where there's simply nobody to
 * list.
 */
function buildInAttendanceSection(data) {
  const trimmed = (data.in_attendance || '').trim();
  return trimmed ? `IN ATTENDANCE:\n${trimmed}` : '';
}

function substitutePlaceholders(template, data) {
  if (!template) return '';
  return normalizeLineEndings(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val === undefined || val === null || val === '' ? '' : normalizeLineEndings(String(val));
  });
}

/**
 * Merges the "Directors Present" multi-select dropdown (directors_present_
 * selected — an array of known directors picked from the company's actual
 * director list) with a freeform "Additional Directors" box (for anyone
 * attending who isn't in that dropdown yet — a newly appointed or alternate
 * director) into one clean line-per-director list for {{directors_present}}.
 * Only kicks in when directors_present_selected is actually present in the
 * submitted data — harmless no-op for any template that doesn't use this
 * pattern (e.g. still returns data.directors_present unchanged if that's
 * all that was submitted, for backward compatibility).
 */
function buildDirectorsPresentList(data) {
  const selected = Array.isArray(data.directors_present_selected)
    ? data.directors_present_selected
    : (data.directors_present_selected ? [data.directors_present_selected] : []);
  const additional = (data.additional_directors || '')
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [...selected, ...additional];
  if (merged.length) return merged.join('\n');
  return data.directors_present || ''; // fall back to a plain textarea if that's what's used instead
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
 * A field can declare depends_on: { key: 'employee_type', values: ['Intern (Paid)'] }
 * meaning it only applies (is shown on the form, and only then enforced as
 * required) when data[key] is one of the listed values. Used for things
 * like "Monthly Stipend" only applying to paid interns, or "Annual CTC"
 * only applying to Full Time / Contract Based hires.
 */
function isFieldApplicable(field, data) {
  if (!field.depends_on) return true;
  const { key, values } = field.depends_on;
  return values.includes(data[key]);
}

/**
 * @param {Array<{key:string,label:string,required:boolean,depends_on?:object}>} fields
 * @param {object} data
 * @returns {string[]} missing field labels (empty array = valid)
 */
function validateFields(fields, data) {
  const missing = [];
  for (const f of fields || []) {
    if (!isFieldApplicable(f, data)) continue; // not applicable right now — don't require it
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
function buildRenderData(companyProfile, formData, templateFields) {
  return {
    company_name: companyProfile?.name || '',
    company_cin: companyProfile?.cin || '',
    company_gstin: companyProfile?.gstin || '',
    company_address: companyProfile?.registered_address || '',
    company_email: companyProfile?.email || '',
    company_website: companyProfile?.website || '',
    company_phone: companyProfile?.phone || '',
    compensation_clause: buildCompensationClause(formData),
    directors_present: buildDirectorsPresentList(formData),
    agenda: formData.agenda ? numberLines(formData.agenda) : formData.agenda,
    resolution_text_full: buildResolutionTextFull(formData),
    in_attendance_section: buildInAttendanceSection(formData),
    share_capital_clause: buildShareCapitalClause(formData),
    ...formatDateFields(templateFields, formatAmountFields(formData)),
  };
}

module.exports = {
  renderTemplate,
  renderCustomBody,
  validateFields,
  isFieldApplicable,
  nextDocumentNumber,
  listDepartmentCodes,
  buildRenderData,
  normalizeLineEndings,
  numberToIndianWords,
};