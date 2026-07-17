// ─────────────────────────────────────────────────────────────────────────
// services/pdfBuilder.js
//
// Turns rendered template text + company/document metadata into an actual
// PDF buffer. Every document gets the same skeleton regardless of type:
//   watermark = faint company name across the page (drawn first, lowest layer)
//   header    = redesigned letterhead (logo, name, CIN/GSTIN, address, contact)
//   metadata  = top-right box: Version / Generated / Document ID
//   title     = template.title_on_page
//   summary   = optional "highlighted fields" box (Position/Salary/etc.)
//   body      = the rendered template text (CR/LF normalized — see note below)
//   footer    = signature + QR verification + seal, one row
//   every page = modern footer strip + page number + SHA-256 content hash
//
// ── Why the old PDF showed "Ð" everywhere ──────────────────────────────────
// Template bodies were saved with Windows-style \r\n line endings. PDFKit
// treats \n specially (starts a new line) but does NOT strip a lone \r —
// it gets drawn as a glyph, and in PDFKit's font encoding table a stray \r
// renders as "Ð". Fix: strip \r before any text reaches PDFKit (see
// normalizeText() below). Do this everywhere text originates from a DB
// column or user input, not just here — documentEngine.js does the same.
//
// ── Why ₹ showed up as ¹ ────────────────────────────────────────────────────
// PDFKit's built-in fonts (Helvetica/Helvetica-Bold) only support the
// WinAnsi/Latin-1 character set (256 codepoints). ₹ (U+20B9) isn't in it,
// so PDFKit silently substitutes a similar-looking glyph. The only real fix
// is a Unicode-capable embedded font — this file loads Noto Sans (Regular +
// Bold) from backend/assets/fonts/ and falls back to Helvetica with a
// console warning if the files aren't present yet, so this never crashes.
//
// No remote image fetching happens in here — the caller (routes/
// document-engine.js) resolves logo/seal/signature URLs to Buffers via
// services/storage.js and passes them in, and now also passes the raw
// `data` object so this module can build the summary box.
//
// ── DEBUG INSTRUMENTATION (temporary) ──────────────────────────────────────
// A silent hang was observed after the contact-line render (no crash, no
// further logs, process just stops responding). Checkpoint logs added
// below through every remaining synchronous stage of the build so we can
// see exactly which section stops executing. Remove once root-caused.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const PAGE_WIDTH = 595.28;  // A4 in points
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 56;     // wider margins per design pass (was 50)

// ── Brand palette ────────────────────────────────────────────────────────
const BRAND = {
  primary: '#0F5132',   // dark green — headers, rules, badges
  primaryTint: '#EAF3EE', // light green — summary box background
  accent: '#0D6EFD',    // blue — links (email/website)
  text: '#1A1A1A',
  muted: '#666666',
  faint: '#999999',
  line: '#0F5132',
};

// ── Unicode font registration ───────────────────────────────────────────
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const REGULAR_TTF = path.join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD_TTF = path.join(FONT_DIR, 'NotoSans-Bold.ttf');
const ITALIC_TTF = path.join(FONT_DIR, 'NotoSans-Italic.ttf'); // optional

let FONT_REG = 'Helvetica';
let FONT_BOLD = 'Helvetica-Bold';
let FONT_ITALIC = 'Helvetica-Oblique';
let UNICODE_FONTS_READY = false;

function registerFonts(doc) {
  const haveRegular = fs.existsSync(REGULAR_TTF);
  const haveBold = fs.existsSync(BOLD_TTF);
  if (haveRegular && haveBold) {
    doc.registerFont('Body', REGULAR_TTF);
    doc.registerFont('BodyBold', BOLD_TTF);
    if (fs.existsSync(ITALIC_TTF)) doc.registerFont('BodyItalic', ITALIC_TTF);
    FONT_REG = 'Body';
    FONT_BOLD = 'BodyBold';
    FONT_ITALIC = fs.existsSync(ITALIC_TTF) ? 'BodyItalic' : 'Body';
    UNICODE_FONTS_READY = true;
  } else {
    UNICODE_FONTS_READY = false;
    console.warn(
      '[pdfBuilder] Noto Sans TTFs not found in backend/assets/fonts/ — falling back to ' +
      'Helvetica, which cannot render ₹, em-dashes, or curly quotes correctly. ' +
      'Add NotoSans-Regular.ttf and NotoSans-Bold.ttf to fix this.'
    );
  }
}

// Strips \r (the actual cause of the "Ð" bug) and collapses stray whitespace
// without touching intentional \n paragraph breaks.
function normalizeText(str) {
  if (!str) return '';
  return String(str).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function formatDateMaybe(value) {
  if (!value) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // not a date-like string, leave as-is
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Indian numbering (comma grouping every 2 digits after the first 3, e.g.
// 3600000 -> "36,00,000") plus a Lacs/Crore suffix, since raw digit counts
// are hard to read at a glance in INR — this is how salary/CTC figures are
// conventionally shown on Indian offer letters and agreements.
function formatIndianAmount(n) {
  const formatted = `\u20B9${n.toLocaleString('en-IN')}`;
  if (n >= 10000000) return `${formatted} (${(n / 10000000).toFixed(2)} Cr)`;
  if (n >= 100000) return `${formatted} (${(n / 100000).toFixed(2)} L)`;
  return formatted;
}

function formatValueForSummary(field, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return '';
  if (field.type === 'date') return formatDateMaybe(rawValue);
  if (field.type === 'number' && /amount|salary|stipend|ctc|price|fee|budget/i.test(field.key)) {
    // Strip any commas the admin/staff may have typed in the input (so
    // "36,00,000" typed into the form still parses correctly) before
    // re-formatting to the canonical Indian-grouped display.
    const n = Number(String(rawValue).replace(/,/g, ''));
    if (!isNaN(n)) return formatIndianAmount(n);
  }
  return normalizeText(String(rawValue));
}

// Fields worth highlighting even if a template author didn't explicitly
// mark them — keeps older templates looking good without editing every
// fields[] array by hand.
const DEFAULT_HIGHLIGHT_KEYS = [
  'position', 'designation', 'department', 'salary', 'stipend',
  'subscription_amount', 'joining_date', 'doj', 'start_date', 'work_location',
  'location', 'reporting_manager', 'duration', 'plan_purchased',
];

function pickSummaryFields(template, data) {
  const fields = template.fields || [];
  const marked = fields.filter((f) => f.highlight === true);
  const chosen = marked.length
    ? marked
    : fields.filter((f) => DEFAULT_HIGHLIGHT_KEYS.includes(f.key));
  return chosen
    .map((f) => ({ label: f.label || f.key, value: formatValueForSummary(f, data[f.key]) }))
    .filter((row) => row.value !== '');
}

async function buildDocumentPdf({ companyProfile, template, generatedDoc, renderedBody, data = {}, images = {} }) {
  const { logoBuffer, sealBuffer, signatureBuffer } = images;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  registerFonts(doc);

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const contentRight = PAGE_WIDTH - PAGE_MARGIN;

  // ── Watermark (drawn first — lowest layer) ─────────────────────────────
  console.log('[pdfBuilder] checkpoint: before watermark');
  if (companyProfile?.name) {
    doc.save();
    doc.opacity(0.05);
    doc.fontSize(60).font(FONT_BOLD).fillColor(BRAND.primary);
    doc.rotate(-35, { origin: [PAGE_WIDTH / 2, PAGE_HEIGHT / 2] });
    doc.text(companyProfile.name.toUpperCase(), 0, PAGE_HEIGHT / 2 - 40, {
      width: PAGE_WIDTH, align: 'center',
    });
    doc.restore();
    doc.opacity(1);
  }
  console.log('[pdfBuilder] checkpoint: after watermark, before letterhead');

  // ── Letterhead ─────────────────────────────────────────────────────────
  const headerTop = 40;
  if (logoBuffer) {
    try { doc.image(logoBuffer, PAGE_MARGIN, headerTop, { width: 44 }); } catch (_) { /* skip corrupt image */ }
  }
  console.log('[pdfBuilder] checkpoint: after logo image, before company name text');

  doc.fontSize(21).font(FONT_BOLD).fillColor(BRAND.primary)
    .text(companyProfile?.name || '', PAGE_MARGIN, headerTop + 2, { width: contentRight - PAGE_MARGIN, align: 'center' });

  doc.fontSize(8).font(FONT_REG).fillColor(BRAND.muted);
  const idLine = [companyProfile?.cin && `CIN: ${companyProfile.cin}`, companyProfile?.gstin && `GSTIN: ${companyProfile.gstin}`]
    .filter(Boolean).join('   \u2022   ');
  if (idLine) doc.text(idLine, PAGE_MARGIN, doc.y + 6, { width: contentRight - PAGE_MARGIN, align: 'center' });
  if (companyProfile?.registered_address) {
    doc.text(normalizeText(companyProfile.registered_address), PAGE_MARGIN, doc.y + 2, { width: contentRight - PAGE_MARGIN, align: 'center' });
  }
  console.log('[pdfBuilder] checkpoint: after name/CIN/address, before contact line');

  // contact line — email/website rendered as real, colored hyperlinks.
  // IMPORTANT: font/size must be set BEFORE measuring widths — widthOfString()
  // measures using the document's *currently active* font/size, it does not
  // read a `font`/`size` passed via its options. Measuring first and setting
  // the font after (the original bug here) could return NaN in some states,
  // and doc.link() then crashes trying to build a PDF annotation rect with a
  // NaN coordinate. Wrapped in try/catch as well so a malformed contact
  // field (bad URL, unexpected characters) degrades gracefully instead of
  // failing the whole document.
  doc.moveDown(0.15);
  const contactY = doc.y;
  try {
    doc.fontSize(8.5).font(FONT_REG);
    const parts = [];
    if (companyProfile?.email) parts.push({ text: companyProfile.email, link: `mailto:${companyProfile.email}`, color: BRAND.accent });
    if (companyProfile?.website) {
      const rawWebsite = normalizeText(companyProfile.website).trim();
      const url = /^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`;
      parts.push({ text: rawWebsite, link: url, color: BRAND.accent });
    }
    if (companyProfile?.phone) parts.push({ text: companyProfile.phone, color: BRAND.muted });

    if (parts.length) {
      const sep = '   |   ';
      const fullWidth = doc.widthOfString(parts.map((p) => p.text).join(sep));
      const fullWidthValid = Number.isFinite(fullWidth);
      let x = fullWidthValid
        ? PAGE_MARGIN + (contentRight - PAGE_MARGIN - fullWidth) / 2
        : PAGE_MARGIN;
      parts.forEach((p, i) => {
        doc.fillColor(p.color).text(p.text, x, contactY, { link: p.link, underline: !!p.link, lineBreak: false });
        const w = doc.widthOfString(p.text);
        x += Number.isFinite(w) ? w : 0;
        if (i < parts.length - 1) {
          doc.fillColor(BRAND.faint).text(sep, x, contactY, { lineBreak: false });
          const sepW = doc.widthOfString(sep);
          x += Number.isFinite(sepW) ? sepW : 0;
        }
      });
      doc.y = contactY + 12;
    }
  } catch (err) {
    console.warn('[pdfBuilder] contact line render failed, skipping hyperlinks', err.message);
    doc.y = contactY;
  }
  console.log('[pdfBuilder] checkpoint: after contact line block, before metadata box');

  // ── Metadata box, top-right corner ──────────────────────────────────────
  const metaBoxW = 150;
  const metaBoxX = contentRight - metaBoxW;
  let metaY = headerTop;
  const metaRow = (label, value) => {
    doc.fontSize(7).font(FONT_REG).fillColor(BRAND.faint).text(label.toUpperCase(), metaBoxX, metaY, { width: metaBoxW, align: 'right' });
    metaY += 9;
    doc.fontSize(9).font(FONT_BOLD).fillColor(BRAND.text).text(value, metaBoxX, metaY, { width: metaBoxW, align: 'right' });
    metaY += 14;
  };
  metaRow('Document ID', generatedDoc.document_number);
  metaRow('Version', `v${generatedDoc.version}.0`);
  metaRow('Generated', generatedDoc.date_str);
  console.log('[pdfBuilder] checkpoint: after metadata box, before divider');

  // ── Divider ────────────────────────────────────────────────────────────
  doc.moveDown(0.6);
  const ruleY = Math.max(doc.y, metaY) + 4;
  doc.moveTo(PAGE_MARGIN, ruleY).lineTo(contentRight, ruleY).lineWidth(1.2).strokeColor(BRAND.line).stroke();
  doc.y = ruleY + 22; // extra breathing room below letterhead (item: more whitespace)
  doc.fillColor(BRAND.text);
  console.log('[pdfBuilder] checkpoint: after divider, before title. title_on_page:', JSON.stringify(template.title_on_page));

  // ── Title ──────────────────────────────────────────────────────────────
  doc.fontSize(16).font(FONT_BOLD).fillColor(BRAND.primary)
    .text(template.title_on_page, { align: 'center', characterSpacing: 0.6 });
  doc.moveDown(1.2);
  doc.fillColor(BRAND.text);
  console.log('[pdfBuilder] checkpoint: after title, before summary box');

  // ── Optional "highlighted fields" summary box ────────────────────────────
  const summaryRows = pickSummaryFields(template, data);
  console.log('[pdfBuilder] checkpoint: summaryRows computed, count:', summaryRows.length, JSON.stringify(summaryRows));
  if (summaryRows.length) {
    const boxX = PAGE_MARGIN;
    const boxW = contentRight - PAGE_MARGIN;
    const rowH = 18;
    const boxH = summaryRows.length * rowH + 16;
    const boxY = doc.y;
    doc.roundedRect(boxX, boxY, boxW, boxH, 4).fillColor(BRAND.primaryTint).fill();
    doc.roundedRect(boxX, boxY, boxW, boxH, 4).lineWidth(0.75).strokeColor(BRAND.primary).stroke();
    let rowY = boxY + 8;
    summaryRows.forEach((row) => {
      doc.fontSize(9).font(FONT_REG).fillColor(BRAND.muted).text(row.label, boxX + 14, rowY, { width: boxW / 2 - 20, lineBreak: false });
      doc.fontSize(9.5).font(FONT_BOLD).fillColor(BRAND.text).text(row.value, boxX + boxW / 2, rowY, { width: boxW / 2 - 14, align: 'right', lineBreak: false });
      rowY += rowH;
    });
    doc.y = boxY + boxH + 20;
    doc.fillColor(BRAND.text);
  }
  console.log('[pdfBuilder] checkpoint: after summary box, before body text. body length:', renderedBody?.length, 'preview:', JSON.stringify((renderedBody || '').slice(0, 80)));

  // ── Body (normalized — this is the actual "Ð" fix) ──────────────────────
  doc.fontSize(11).font(FONT_REG).fillColor(BRAND.text)
    .text(normalizeText(renderedBody), { align: 'left', lineGap: 4, paragraphGap: 6 });
  console.log('[pdfBuilder] checkpoint: after body text, before signature/qr/seal block');

  // ── Signature / QR verification / Seal — one compact row ────────────────
  const BLOCK_HEIGHT = 120;
  const PAGE_BOTTOM = 745;
  doc.moveDown(2.5);
  if (doc.y + BLOCK_HEIGHT > PAGE_BOTTOM) doc.addPage();
  const blockTop = doc.y;
  console.log('[pdfBuilder] checkpoint: blockTop computed:', blockTop, 'requires_signature:', template.requires_signature, 'requires_qr:', template.requires_qr, 'requires_seal:', template.requires_seal);

  if (template.requires_signature) {
    if (signatureBuffer) {
      try { doc.image(signatureBuffer, PAGE_MARGIN, blockTop, { width: 120, height: 42 }); } catch (_) { /* skip */ }
    } else {
      doc.moveTo(PAGE_MARGIN, blockTop + 38).lineTo(PAGE_MARGIN + 160, blockTop + 38).lineWidth(0.5).strokeColor(BRAND.muted).stroke();
    }
    doc.fontSize(7).font(FONT_BOLD).fillColor(BRAND.primary).text('DIGITALLY SIGNED', PAGE_MARGIN, blockTop + 48, { characterSpacing: 0.8, lineBreak: false });
    doc.fontSize(9.5).font(FONT_BOLD).fillColor(BRAND.text).text(companyProfile?.default_signatory_name || 'Authorized Signatory', PAGE_MARGIN, blockTop + 60, { width: 190, lineBreak: false });
    doc.fontSize(8).font(FONT_REG).fillColor(BRAND.muted).text(companyProfile?.default_signatory_title || '', PAGE_MARGIN, blockTop + 73, { width: 190, lineBreak: false });
    doc.text(companyProfile?.name || '', PAGE_MARGIN, blockTop + 85, { width: 190, lineBreak: false });
  }
  console.log('[pdfBuilder] checkpoint: after signature block, before QR block');

  if (template.requires_qr) {
    const qrX = PAGE_MARGIN + 230;
    const verifyUrl = `${companyProfile?.verification_base_url}/${generatedDoc.document_number}`;
    console.log('[pdfBuilder] checkpoint: before QRCode.toDataURL, verifyUrl:', verifyUrl);
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0 });
    console.log('[pdfBuilder] checkpoint: after QRCode.toDataURL');
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, blockTop, { width: 58 });
    doc.fontSize(6.5).font(FONT_BOLD).fillColor(BRAND.primary).text('\u2713 Scan to verify', qrX - 20, blockTop + 61, { width: 100, align: 'center', lineBreak: false });
    doc.fontSize(6).font(FONT_REG).fillColor(BRAND.faint).text(generatedDoc.document_number, qrX - 20, blockTop + 71, { width: 100, align: 'center', lineBreak: false });
  }
  console.log('[pdfBuilder] checkpoint: after QR block, before seal block');

  if (template.requires_seal) {
    const sealSize = 77; // ~15% smaller than the old 90 — signature dominates, seal supports
    const sealX = contentRight - sealSize;
    if (sealBuffer) {
      try { doc.image(sealBuffer, sealX, blockTop, { width: sealSize, height: sealSize }); } catch (_) { drawVectorSeal(doc, sealX, blockTop, sealSize, companyProfile?.name); }
    } else {
      drawVectorSeal(doc, sealX, blockTop, sealSize, companyProfile?.name);
    }
  }
  console.log('[pdfBuilder] checkpoint: after seal block, before footer/page loop');

  doc.y = blockTop + BLOCK_HEIGHT;

  // ── Modern footer + page numbers + content hash, every page ────────────
  const contentHash = crypto
    .createHash('sha256')
    .update(`${template.code}|${generatedDoc.document_number}|${generatedDoc.version}|${JSON.stringify(data)}`)
    .digest('hex');

  const range = doc.bufferedPageRange();
  console.log('[pdfBuilder] checkpoint: bufferedPageRange:', JSON.stringify(range));
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = 770;
    doc.moveTo(PAGE_MARGIN, bottom - 6).lineTo(contentRight, bottom - 6).lineWidth(0.5).strokeColor('#DDDDDD').stroke();
    doc.fontSize(7).font(FONT_REG).fillColor(BRAND.muted).text(
      'This document is digitally generated by EtherTrack ERP. No physical signature is required if digitally verified.',
      PAGE_MARGIN, bottom, { width: 360 }
    );
    doc.fontSize(6.5).font(FONT_REG).fillColor(BRAND.faint).text(
      `SHA256  ${contentHash.slice(0, 32)}...`, PAGE_MARGIN, bottom + 11, { width: 360, lineBreak: false }
    );
    doc.fontSize(7).font(FONT_REG).fillColor(BRAND.muted).text(
      `${generatedDoc.document_number}  |  v${generatedDoc.version}  |  ${generatedDoc.status}`,
      contentRight - 200, bottom, { width: 200, align: 'right' }
    );
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, contentRight - 200, bottom + 11, { width: 200, align: 'right' });
    doc.fillColor(BRAND.text);
  }
  console.log('[pdfBuilder] checkpoint: after footer/page loop, calling doc.end()');

  doc.end();
  console.log('[pdfBuilder] checkpoint: doc.end() called, awaiting stream completion');
  return done;
}

function drawVectorSeal(doc, x, y, size, companyName) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rOuter = size / 2 - 3;
  const rInner = rOuter - 8;
  doc.save();
  doc.lineWidth(1.1).circle(cx, cy, rOuter).strokeColor(BRAND.primary).stroke();
  doc.circle(cx, cy, rInner).stroke();
  doc.fontSize(6).font(FONT_BOLD).fillColor(BRAND.primary)
    .text((companyName || 'COMPANY SEAL').toUpperCase(), x, y + size / 2 - 8, { width: size, align: 'center' });
  doc.fontSize(5.5).font(FONT_REG).text('OFFICIAL SEAL', x, y + size / 2 + 2, { width: size, align: 'center' });
  doc.fillColor(BRAND.text);
  doc.restore();
}

module.exports = { buildDocumentPdf, normalizeText, UNICODE_FONTS_READY };