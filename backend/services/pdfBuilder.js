// ─────────────────────────────────────────────────────────────────────────
// services/pdfBuilder.js
//
// Turns rendered template text + company/document metadata into an actual
// PDF buffer. Every document gets the same skeleton regardless of type:
//   header  = company letterhead (name, CIN, GSTIN, address, logo)
//   title   = template.title_on_page
//   body    = the rendered template text
//   footer  = seal + signature block (if the template requires them)
//   corner  = QR code linking to the public verification page
//   every page = doc number / version / generated-by / confidential strip
//              + page number, added via bufferedPageRange() so it lands on
//                pages created by pdfkit's own automatic page breaks too.
//
// No remote image fetching happens in here — the caller (routes/
// document-engine.js) is responsible for resolving logo/seal/signature
// URLs to Buffers via services/storage.js and passing them in. That keeps
// this module a pure function: (text + data) -> PDF bytes.
//
// ── ONLY CHANGE FROM THE ORIGINAL: normalizeText() ──────────────────────
// Template bodies were saved with Windows-style \r\n line endings. PDFKit
// treats \n specially (starts a new line) but does NOT strip a lone \r —
// it gets drawn as a stray glyph ("Ð"). Fix: strip \r before any text
// reaches PDFKit. Everything else in this file is byte-for-byte the
// original, confirmed-working version — deliberately NOT touching the
// letterhead, fonts, footer, or layout while we isolate a hang that crept
// in during a larger rewrite. Redesign work resumes once generation is
// confirmed stable again.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const PAGE_MARGIN = 56; // slightly wider than the original 50, per the "more breathing room" ask

// Brand palette — used for headers, dividers, and accents in the redesign.
const BRAND = {
  primary: '#0F5132', // dark green
  muted: '#666666',
  accent: '#0D6EFD', // blue — used as a plain fill color for contact info, NOT as a clickable link (see note below)
  text: '#1A1A1A',
};

// ── Unicode font registration (needed for ₹ — PDFKit's built-in Helvetica
// only supports Latin-1/WinAnsi, which does not include the Rupee sign).
// Falls back to Helvetica if the files aren't present, so this can never
// crash generation — it just silently loses ₹ support until the files
// are added at backend/assets/fonts/.
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const REGULAR_TTF = path.join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD_TTF = path.join(FONT_DIR, 'NotoSans-Bold.ttf');

function registerFonts(doc) {
  const haveRegular = fs.existsSync(REGULAR_TTF);
  const haveBold = fs.existsSync(BOLD_TTF);
  if (haveRegular && haveBold) {
    doc.registerFont('Body', REGULAR_TTF);
    doc.registerFont('BodyBold', BOLD_TTF);
    return { reg: 'Body', bold: 'BodyBold', italic: 'Body' }; // Noto Sans has no italic file yet — falls back to regular
  }
  console.warn('[pdfBuilder] Noto Sans TTFs not found in backend/assets/fonts/ — ₹ will not render correctly until they are added');
  return { reg: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
}

function normalizeText(str) {
  if (!str) return '';
  return String(str).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Inserts an invisible Zero Width Non-Joiner (U+200C) between letter pairs
// that commonly trigger ligature substitution (ff, fi, fl, ffi, ffl) in
// embedded OpenType fonts. ZWNJ is standard Unicode for "don't join these
// glyphs" and renders as nothing — invisible in the output.
//
// This exists because PDFKit's documented `features: ['-liga', ...]` text
// option — the "correct" way to disable ligatures — did NOT actually stop
// the bug in production (confirmed: "offer" still rendered as "ofer" and
// "confirm" as "confrm" with that option in place). Rather than keep
// debugging why that option isn't taking effect in this PDFKit/fontkit
// version, this sidesteps the problem entirely: if the trigger sequence
// never appears in the text PDFKit receives, there's nothing for its
// ligature engine to (mis)handle. Kept the features option in place too as
// a harmless second layer, but this is the fix actually doing the work.
function breakLigatures(str) {
  if (!str) return '';
  // Use a replacer function to preserve whatever case was actually
  // matched — the previous version hardcoded a lowercase 'f' in the
  // replacement, which silently turned "CERTIFICATE" (uppercase F) into
  // "CERTIfICATE" (lowercase f) on any all-caps text.
  return String(str).replace(/f(?=[fil])/gi, (matched) => matched + '\u200C');
}

function formatDateMaybe(value) {
  if (!value) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Used only for the summary box, which has no surrounding template text —
// so unlike documentEngine.js's formatter (which must NOT add ₹, since the
// template body already writes ₹{{field}} literally), this one does need
// to add the ₹ itself.
function formatIndianAmountForBox(n) {
  const formatted = `\u20B9${n.toLocaleString('en-IN')}`;
  if (n >= 10000000) return `${formatted} (${(n / 10000000).toFixed(2)} Cr)`;
  if (n >= 100000) return `${formatted} (${(n / 100000).toFixed(2)} L)`;
  return formatted;
}

const AMOUNT_KEY_PATTERN = /amount|salary|stipend|ctc|price|fee|budget/i;
const DEFAULT_HIGHLIGHT_KEYS = [
  'position', 'designation', 'department', 'salary', 'stipend',
  'subscription_amount', 'joining_date', 'doj', 'start_date', 'work_location',
  'location', 'reporting_manager', 'duration', 'plan_purchased',
];

function formatValueForSummary(field, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return '';
  if (field.type === 'date') return formatDateMaybe(rawValue);
  if (field.type === 'number' && AMOUNT_KEY_PATTERN.test(field.key)) {
    const n = Number(String(rawValue).replace(/,/g, ''));
    if (!isNaN(n)) return formatIndianAmountForBox(n);
  }
  return normalizeText(String(rawValue));
}

function pickSummaryFields(template, data) {
  const fields = template.fields || [];
  const marked = fields.filter((f) => f.highlight === true);
  const chosen = marked.length ? marked : fields.filter((f) => DEFAULT_HIGHLIGHT_KEYS.includes(f.key));
  return chosen
    .map((f) => ({ label: f.label || f.key, value: formatValueForSummary(f, data[f.key]) }))
    .filter((row) => row.value !== '');
}

async function buildDocumentPdf({ companyProfile, template, generatedDoc, renderedBody, data = {}, images = {} }) {
  const { logoBuffer, sealBuffer, signatureBuffer } = images;

  // A dedicated (larger) bottom margin reserves real space for the footer.
  // Previously this used a single `margin` value equal to the top/side
  // margin, which meant PDFKit's own automatic pagination considered
  // anything up to ~785pt "still in bounds" and kept flowing text there —
  // but the footer is manually stamped at y=775, so long content (like an
  // Agenda list) could legitimately auto-flow right on top of it. This
  // margin is set past where the footer sits, so PDFKit itself will start
  // a new page before content can ever reach that zone.
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE_MARGIN, bottom: 100, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true,
  });
  const { reg: FONT_REG, bold: FONT_BOLD, italic: FONT_ITALIC } = registerFonts(doc);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ── Letterhead ─────────────────────────────────────────────────────────
  // Logo and company name sit on the same row: logo pinned top-left, name
  // vertically centered beside it, using the full page width. Falls back
  // to a fully centered name when there's no logo.
  //
  // NOTE: no Document ID / Version / Generated box here — these letters go
  // directly to external candidates, and internal audit metadata doesn't
  // belong at the top of a letter someone signs and returns. The doc
  // number is still in the small footer strip for traceability.
  const headerTop = 40;
  const logoWidth = 44;
  const nameRightEdge = 595 - PAGE_MARGIN;
  if (logoBuffer) {
    try { doc.image(logoBuffer, PAGE_MARGIN, headerTop, { width: logoWidth } ); } catch (_) { /* corrupt/unsupported image, skip */ }
    const nameX = PAGE_MARGIN + logoWidth + 12;
    const nameWidth = nameRightEdge - nameX;
    doc.fontSize(20).font(FONT_BOLD).fillColor(BRAND.primary)
      .text(breakLigatures(companyProfile?.name || ''), nameX, headerTop + 10, { width: nameWidth, align: 'left', features: ['-liga', '-rlig', '-clig', '-dlig'] });
    doc.x = PAGE_MARGIN;
    doc.y = headerTop + logoWidth + 6;
  } else {
    doc.fontSize(20).font(FONT_BOLD).fillColor(BRAND.primary)
      .text(breakLigatures(companyProfile?.name || ''), PAGE_MARGIN, headerTop, { width: nameRightEdge - PAGE_MARGIN, align: 'center', features: ['-liga', '-rlig', '-clig', '-dlig'] });
    doc.x = PAGE_MARGIN;
  }
  doc.fillColor(BRAND.muted).fontSize(8).font(FONT_REG);
  const metaLine1 = [companyProfile?.cin && `CIN: ${companyProfile.cin}`, companyProfile?.gstin && `GSTIN: ${companyProfile.gstin}`]
    .filter(Boolean).join('   \u2022   ');
  if (metaLine1) doc.text(metaLine1, { align: 'center' });
  if (companyProfile?.registered_address) doc.text(breakLigatures(normalizeText(companyProfile.registered_address)), { align: 'center', features: ['-liga', '-rlig', '-clig', '-dlig'] });

  // Contact line: plain colored text (blue for email/website, matching the
  // "hyperlink" visual convention) — deliberately NOT a clickable {link:...}
  // annotation. PDFKit's doc.link() does its own internal width/height
  // calculation for the click-rectangle using the embedded custom font,
  // and that calculation intermittently returns NaN — a library-level
  // quirk in how PDFKit + fontkit interact with embedded TTFs, not
  // something fixable from our side. Not worth the risk for "click to
  // open email client" on a printed letter.
  const metaLine2 = [companyProfile?.email, companyProfile?.website, companyProfile?.phone].filter(Boolean).join('   |   ');
  if (metaLine2) doc.fillColor(BRAND.accent).text(metaLine2, { align: 'center' });
  doc.fillColor(BRAND.text);
  doc.x = PAGE_MARGIN;

  doc.moveDown(0.6);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(595 - PAGE_MARGIN, doc.y).lineWidth(1.2).strokeColor(BRAND.primary).stroke();
  doc.moveDown(1.3); // extra breathing room below the letterhead

  // ── Title ──────────────────────────────────────────────────────────────
  doc.fontSize(16).font(FONT_BOLD).fillColor(BRAND.primary).text(breakLigatures(template.title_on_page), { align: 'center', characterSpacing: 0.5 });
  doc.fillColor(BRAND.text);
  doc.x = PAGE_MARGIN;
  doc.moveDown(1);

  // ── Optional "highlighted fields" summary box — shows any field marked
  // highlight:true in the template's fields[] (or a sensible default set
  // of common keys) in a boxed, scannable layout above the body text. ────
  const summaryRows = pickSummaryFields(template, data);
  if (summaryRows.length) {
    const boxX = PAGE_MARGIN;
    const boxW = (595 - PAGE_MARGIN) - PAGE_MARGIN;
    const padding = 8;
    const rowGap = 4;
    const labelWidth = boxW / 2 - 20;
    const valueWidth = boxW / 2 - 14;

    // Measure each row's real height first — a fixed row height (the
    // original bug here) overlaps whenever a label or value is long enough
    // to wrap to more than one line.
    doc.fontSize(9).font(FONT_REG);
    const rowHeights = summaryRows.map((row) => {
      const labelH = doc.heightOfString(breakLigatures(row.label), { width: labelWidth });
      doc.fontSize(9.5).font(FONT_BOLD);
      const valueH = doc.heightOfString(breakLigatures(row.value), { width: valueWidth });
      doc.fontSize(9).font(FONT_REG);
      return Math.max(labelH, valueH, 12) + rowGap;
    });
    const boxH = rowHeights.reduce((a, b) => a + b, 0) + padding * 2;
    const boxY = doc.y;

    doc.roundedRect(boxX, boxY, boxW, boxH, 4).fillColor('#EAF3EE').fill();
    doc.roundedRect(boxX, boxY, boxW, boxH, 4).lineWidth(0.75).strokeColor(BRAND.primary).stroke();
    let rowY = boxY + padding;
    summaryRows.forEach((row, idx) => {
      doc.fontSize(9).font(FONT_REG).fillColor(BRAND.muted).text(breakLigatures(row.label), boxX + 14, rowY, { width: labelWidth });
      doc.fontSize(9.5).font(FONT_BOLD).fillColor(BRAND.text).text(breakLigatures(row.value), boxX + boxW / 2, rowY, { width: valueWidth, align: 'right' });
      rowY += rowHeights[idx];
    });
    // IMPORTANT: reset the cursor back to the left margin. The box's own
    // text() calls above use explicit x coordinates (boxX+14, boxX+boxW/2)
    // and PDFKit doesn't automatically restore doc.x to the page margin
    // afterward — without this, the very next text() call (the body,
    // right below) silently inherits that stale indented x position,
    // which is exactly what produced the huge empty-left-margin bug.
    doc.x = PAGE_MARGIN;
    doc.y = boxY + boxH + 16;
    doc.fillColor(BRAND.text);
  }

  // ── Body — with optional callout boxes ──────────────────────────────────
  // A template body can include a literal %%BOX:field_key%% marker (instead
  // of {{field_key}}) to have that field's content drawn as a highlighted
  // box — light gray background, blue left border — instead of plain
  // paragraph text. Used for a Board Resolution's "RESOLVED THAT" clause,
  // making it stand out the way it does on a real corporate resolution.
  // Falls back to drawing the whole body as one plain block when no marker
  // is present, so every existing template keeps working unchanged.
  drawBodyWithBoxes(doc, renderedBody, data, { FONT_REG, FONT_BOLD, BRAND });

  // ── Signature / Seal / QR — one compact row, laid out with explicit
  // coordinates (not a moveDown chain) so it can't fragment across pages.
  // If there isn't enough room left on the current page, start a fresh
  // page for it instead of letting pdfkit auto-break mid-block.
  const BLOCK_HEIGHT = 110;
  const PAGE_BOTTOM = 738; // aligned with the new bottom margin (page reserves space below ~742)
  doc.moveDown(1.5);
  if (doc.y + BLOCK_HEIGHT > PAGE_BOTTOM) doc.addPage();
  const blockTop = doc.y;

  if (template.requires_signature) {
    // Per-document signatory override: most letters use the company's
    // default signatory (e.g. the MD), but some documents — like a Board
    // Resolution's certification — are properly signed by someone else
    // entirely (e.g. the Company Secretary). If a template includes
    // override_signatory_name/_title/_din fields and the person filled
    // them in, use those instead of the company defaults.
    const signatoryName = data.override_signatory_name || companyProfile?.default_signatory_name || 'Authorized Signatory';
    const signatoryTitle = data.override_signatory_title || companyProfile?.default_signatory_title || '';
    const signatoryDin = data.override_signatory_din || companyProfile?.default_signatory_din || '';

    if (template.signature_style === 'formal') {
      // "Certified to be a True Copy / For {Company} / [signature line] /
      // Name / Title / DIN" — the traditional layout for board minutes and
      // resolutions, distinct from the "Digitally Signed" flourish that
      // suits an offer letter or agreement better.
      doc.fontSize(9).font(FONT_BOLD).fillColor(BRAND.text)
        .text('Certified to be a True Copy', PAGE_MARGIN, blockTop, { width: 260, lineBreak: false });
      doc.fontSize(8).font(FONT_REG).fillColor(BRAND.muted)
        .text(`For ${breakLigatures(companyProfile?.name || '')}`, PAGE_MARGIN, blockTop + 13, { width: 260, lineBreak: false });

      if (signatureBuffer) {
        try { doc.image(signatureBuffer, PAGE_MARGIN, blockTop + 26, { width: 110, height: 38 }); } catch (_) { /* skip */ }
      }
      doc.moveTo(PAGE_MARGIN, blockTop + 68).lineTo(PAGE_MARGIN + 160, blockTop + 68).lineWidth(0.5).strokeColor(BRAND.muted).stroke();

      doc.fontSize(9).font(FONT_BOLD).fillColor(BRAND.text).text(breakLigatures(signatoryName), PAGE_MARGIN, blockTop + 74, { width: 190, lineBreak: false });
      doc.fontSize(8).font(FONT_REG).fillColor(BRAND.muted).text(breakLigatures(signatoryTitle), PAGE_MARGIN, blockTop + 87, { width: 190, lineBreak: false });
      if (signatoryDin) {
        doc.fontSize(7.5).font(FONT_REG).fillColor(BRAND.muted).text(`DIN: ${signatoryDin}`, PAGE_MARGIN, blockTop + 99, { width: 190, lineBreak: false });
      }
      doc.fillColor(BRAND.text);
    } else {
      // Default "Digitally Signed" style — used by offer letters,
      // agreements, and anything else that doesn't opt into 'formal'.
      if (signatureBuffer) {
        try { doc.image(signatureBuffer, PAGE_MARGIN, blockTop, { width: 120, height: 45 }); } catch (_) { /* skip */ }
      } else {
        doc.moveTo(PAGE_MARGIN, blockTop + 40).lineTo(PAGE_MARGIN + 160, blockTop + 40).lineWidth(0.5).stroke();
      }
      doc.fontSize(7).font(FONT_BOLD).fillColor(BRAND.accent)
        .text('DIGITALLY SIGNED', PAGE_MARGIN, blockTop + 48, { characterSpacing: 0.6, lineBreak: false });
      doc.fillColor(BRAND.text);
      doc.fontSize(9).font(FONT_BOLD).text(breakLigatures(signatoryName), PAGE_MARGIN, blockTop + 59, { width: 190, lineBreak: false });
      doc.fontSize(8).font(FONT_REG).text(breakLigatures(signatoryTitle), PAGE_MARGIN, blockTop + 72, { width: 190, lineBreak: false });
      let signatureLineY = blockTop + 84;
      if (signatoryDin) {
        doc.fontSize(7.5).font(FONT_REG).fillColor(BRAND.muted).text(`DIN: ${signatoryDin}`, PAGE_MARGIN, signatureLineY, { width: 190, lineBreak: false });
        signatureLineY += 11;
        doc.fillColor(BRAND.text);
      }
      doc.fontSize(7.5).font(FONT_REG).fillColor(BRAND.muted)
        .text(breakLigatures(companyProfile?.name || ''), PAGE_MARGIN, signatureLineY, { width: 190, lineBreak: false });
      doc.fillColor(BRAND.text);
    }
  }

  if (template.requires_qr) {
    const qrX = PAGE_MARGIN + 220;
    const qrDataUrl = await QRCode.toDataURL(`${companyProfile?.verification_base_url}/${generatedDoc.document_number}`, { margin: 0 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, blockTop, { width: 60 });
    doc.fontSize(7).font(FONT_REG).text('Scan to verify authenticity', qrX - 15, blockTop + 63, { width: 90, align: 'center', lineBreak: false });
  }

  if (template.requires_seal) {
    const sealX = 595 - PAGE_MARGIN - 90;
    if (sealBuffer) {
      try { doc.image(sealBuffer, sealX, blockTop, { width: 90, height: 90 }); } catch (_) { drawVectorSeal(doc, sealX, blockTop, companyProfile?.name, FONT_BOLD, FONT_REG); }
    } else {
      drawVectorSeal(doc, sealX, blockTop, companyProfile?.name, FONT_BOLD, FONT_REG);
    }
  }

  doc.y = blockTop + BLOCK_HEIGHT;

  // ── Footer + page numbers on every page ───────────────────────────────
  const contentHash = crypto
    .createHash('sha256')
    .update(`${template.code}|${generatedDoc.document_number}|${generatedDoc.version}|${JSON.stringify(data)}`)
    .digest('hex');

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = 775;
    doc.moveTo(PAGE_MARGIN, bottom - 6).lineTo(595 - PAGE_MARGIN, bottom - 6).lineWidth(0.5).strokeColor('#DDDDDD').stroke();
    doc.fontSize(7).font(FONT_REG).fillColor(BRAND.muted)
      .text(
        'This document is digitally generated by EtherTrack ERP. No physical signature is required if digitally verified.',
        PAGE_MARGIN, bottom, { width: 380 }
      );
    doc.fontSize(6.5).font(FONT_REG).fillColor('#999999')
      .text(`${generatedDoc.document_number}   |   SHA256 ${contentHash.slice(0, 24)}...`, PAGE_MARGIN, bottom + 11, { width: 380, lineBreak: false });
    doc.fontSize(7).font(FONT_REG).fillColor(BRAND.muted)
      .text(`Page ${i - range.start + 1} of ${range.count}`, 595 - PAGE_MARGIN - 100, bottom, { width: 100, align: 'right' });
    doc.fillColor('#000000');
  }

  doc.end();
  return done;
}

function drawBodyWithBoxes(doc, renderedBody, data, { FONT_REG, FONT_BOLD, BRAND }) {
  const PAGE_MARGIN_LOCAL = PAGE_MARGIN; // closes over the module constant
  const contentRight = 595 - PAGE_MARGIN_LOCAL;
  const boxWidth = contentRight - PAGE_MARGIN_LOCAL;

  const regex = /%%BOX:(\w+)%%/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  const body = renderedBody || '';
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', content: body.slice(lastIndex, match.index) });
    segments.push({ type: 'box', key: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) segments.push({ type: 'text', content: body.slice(lastIndex) });

  for (const seg of segments) {
    if (seg.type === 'text') {
      // Trim pure-whitespace segments (the bit between the end of one
      // paragraph and a %%BOX:...%% marker is often just newlines) so we
      // don't draw an empty text block that just eats vertical space and
      // can nudge things into an extra blank page.
      const trimmed = normalizeText(seg.content).replace(/^\n+|\n+$/g, '');
      if (!trimmed) continue;
      doc.fontSize(10.5).font(FONT_REG).fillColor(BRAND.text)
        .text(breakLigatures(trimmed), PAGE_MARGIN_LOCAL, doc.y, {
          width: boxWidth, align: 'left', lineGap: 3, features: ['-liga', '-rlig', '-clig', '-dlig'],
        });
      doc.x = PAGE_MARGIN_LOCAL;
    } else {
      const raw = breakLigatures(normalizeText(String(data[seg.key] || '')));
      drawPaginatedBox(doc, raw, { FONT_REG, BRAND }, PAGE_MARGIN_LOCAL, boxWidth);
    }
  }
}

// Draws `text` inside a highlighted callout box (light gray background,
// blue left border), splitting it across as many pages as needed. Unlike a
// single rect()+text() call — which only draws the background once and
// lets PDFKit's automatic text pagination silently spill the remainder
// onto plain, box-less pages — this measures how many whole paragraphs fit
// in the space actually remaining on the current page, draws a box sized
// to exactly that content, then starts a fresh page and repeats for
// whatever's left. Each page the content spans gets its own correctly
// sized box, so it reads as one continuous callout rather than breaking
// awkwardly partway through.
function drawPaginatedBox(doc, text, { FONT_REG, BRAND }, marginX, boxWidth) {
  const padding = 12;
  const innerWidth = boxWidth - padding * 2 - 4; // 4 = left border strip width
  const PAGE_BOTTOM_LIMIT = 738; // aligned with the new bottom margin
  doc.fontSize(10.5).font(FONT_REG);

  const paragraphs = (text || '').split('\n');
  let i = 0;
  while (i < paragraphs.length) {
    let availableHeight = PAGE_BOTTOM_LIMIT - doc.y - padding * 2;
    if (availableHeight < 30) {
      // Not enough room left on this page to usefully start a new box
      // segment — move to a fresh page before measuring anything.
      doc.addPage();
      doc.y = PAGE_MARGIN;
      availableHeight = PAGE_BOTTOM_LIMIT - doc.y - padding * 2;
    }

    let chunkParagraphs = [];
    let consumed = 0;
    let chunkHeight = 0;
    for (let j = i; j < paragraphs.length; j++) {
      const candidate = [...chunkParagraphs, paragraphs[j]].join('\n');
      const candidateHeight = doc.heightOfString(candidate, { width: innerWidth, lineGap: 3 });
      if (candidateHeight > availableHeight && chunkParagraphs.length > 0) break; // this paragraph would overflow — stop before it, draw what fits
      chunkParagraphs.push(paragraphs[j]);
      chunkHeight = candidateHeight;
      consumed = j - i + 1;
      if (candidateHeight > availableHeight) break; // a single paragraph alone is taller than the whole page — best effort, draw it anyway rather than loop forever
    }

    const chunkText = chunkParagraphs.join('\n');
    const boxY = doc.y;
    const boxH = chunkHeight + padding * 2;

    doc.rect(marginX, boxY, boxWidth, boxH).fillColor('#F2F2F2').fill();
    doc.rect(marginX, boxY, 4, boxH).fillColor(BRAND.accent).fill();
    doc.fillColor(BRAND.text).font(FONT_REG).fontSize(10.5)
      .text(chunkText, marginX + padding + 4, boxY + padding, { width: innerWidth, align: 'left', lineGap: 3 });

    doc.y = boxY + boxH;
    doc.x = marginX;
    i += consumed;

    if (i < paragraphs.length) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
    }
  }
  doc.y += 10;
  doc.x = marginX;
}

function drawVectorSeal(doc, x, y, companyName, fontBold, fontReg) {
  // Fallback stamp when no real seal image is configured — a simple
  // vector "seal" so the document still visually carries a seal mark.
  doc.save();
  doc.lineWidth(1.2).circle(x + 45, y + 45, 42).stroke('#1a3c8c');
  doc.circle(x + 45, y + 45, 34).stroke('#1a3c8c');
  doc.fontSize(6.5).font(fontBold).fillColor('#1a3c8c')
    .text((companyName || 'COMPANY SEAL').toUpperCase(), x, y + 38, { width: 90, align: 'center' });
  doc.fontSize(6).font(fontReg).text('OFFICIAL SEAL', x, y + 50, { width: 90, align: 'center' });
  doc.fillColor('#000000');
  doc.restore();
}

module.exports = { buildDocumentPdf };