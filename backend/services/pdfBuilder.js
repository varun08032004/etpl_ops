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
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const PAGE_MARGIN = 50;

async function buildDocumentPdf({ companyProfile, template, generatedDoc, renderedBody, images = {} }) {
  const { logoBuffer, sealBuffer, signatureBuffer } = images;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ── Letterhead ─────────────────────────────────────────────────────────
  if (logoBuffer) {
    try { doc.image(logoBuffer, PAGE_MARGIN, 40, { width: 60 }); } catch (_) { /* corrupt/unsupported image, skip */ }
  }
  doc.fontSize(15).font('Helvetica-Bold').text(companyProfile?.name || '', { align: 'center' });
  doc.fontSize(8).font('Helvetica');
  const metaLine1 = [companyProfile?.cin && `CIN: ${companyProfile.cin}`, companyProfile?.gstin && `GSTIN: ${companyProfile.gstin}`]
    .filter(Boolean).join('  |  ');
  if (metaLine1) doc.text(metaLine1, { align: 'center' });
  if (companyProfile?.registered_address) doc.text(companyProfile.registered_address, { align: 'center' });
  const metaLine2 = [companyProfile?.email, companyProfile?.website, companyProfile?.phone].filter(Boolean).join('  |  ');
  if (metaLine2) doc.text(metaLine2, { align: 'center' });

  doc.moveDown(0.5);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(595 - PAGE_MARGIN, doc.y).lineWidth(0.5).stroke();
  doc.moveDown(0.75);

  // ── Title ──────────────────────────────────────────────────────────────
  doc.fontSize(13).font('Helvetica-Bold').text(template.title_on_page, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(8).font('Helvetica-Oblique')
    .text(`Doc No: ${generatedDoc.document_number}   |   Version: ${generatedDoc.version}   |   Date: ${generatedDoc.date_str}`, { align: 'center' });
  doc.moveDown(1);

  // ── Body ───────────────────────────────────────────────────────────────
  doc.fontSize(10.5).font('Helvetica').text(renderedBody, { align: 'left', lineGap: 3 });

  // ── Signature / Seal / QR — one compact row, laid out with explicit
  // coordinates (not a moveDown chain) so it can't fragment across pages.
  // If there isn't enough room left on the current page, start a fresh
  // page for it instead of letting pdfkit auto-break mid-block.
  const BLOCK_HEIGHT = 110;
  const PAGE_BOTTOM = 755; // leaves room below for the footer strip at y=775
  doc.moveDown(2);
  if (doc.y + BLOCK_HEIGHT > PAGE_BOTTOM) doc.addPage();
  const blockTop = doc.y;

  if (template.requires_signature) {
    if (signatureBuffer) {
      try { doc.image(signatureBuffer, PAGE_MARGIN, blockTop, { width: 120, height: 45 }); } catch (_) { /* skip */ }
    } else {
      doc.moveTo(PAGE_MARGIN, blockTop + 40).lineTo(PAGE_MARGIN + 160, blockTop + 40).lineWidth(0.5).stroke();
    }
    doc.fontSize(9).font('Helvetica-Bold').text(companyProfile?.default_signatory_name || 'Authorized Signatory', PAGE_MARGIN, blockTop + 48, { width: 180, lineBreak: false });
    doc.fontSize(8).font('Helvetica').text(companyProfile?.default_signatory_title || '', PAGE_MARGIN, blockTop + 61, { width: 180, lineBreak: false });
    doc.text('For and on behalf of the Company', PAGE_MARGIN, blockTop + 73, { width: 180, lineBreak: false });
  }

  if (template.requires_qr) {
    const qrX = PAGE_MARGIN + 220;
    const qrDataUrl = await QRCode.toDataURL(`${companyProfile?.verification_base_url}/${generatedDoc.document_number}`, { margin: 0 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, blockTop, { width: 60 });
    doc.fontSize(7).font('Helvetica').text('Scan to verify authenticity', qrX - 15, blockTop + 63, { width: 90, align: 'center', lineBreak: false });
  }

  if (template.requires_seal) {
    const sealX = 595 - PAGE_MARGIN - 90;
    if (sealBuffer) {
      try { doc.image(sealBuffer, sealX, blockTop, { width: 90, height: 90 }); } catch (_) { drawVectorSeal(doc, sealX, blockTop, companyProfile?.name); }
    } else {
      drawVectorSeal(doc, sealX, blockTop, companyProfile?.name);
    }
  }

  doc.y = blockTop + BLOCK_HEIGHT;

  // ── Footer + page numbers on every page ───────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = 775; // stays inside the default 50pt bottom margin boundary (792) —
                         // placing footer text past that silently makes pdfkit auto-add a page
    doc.fontSize(7).font('Helvetica').fillColor('#666666')
      .text(
        `${generatedDoc.document_number}  |  v${generatedDoc.version}  |  Status: ${generatedDoc.status}  |  Generated by ${generatedDoc.generated_by_name || 'System'}  |  CONFIDENTIAL`,
        PAGE_MARGIN, bottom, { width: 400 }
      );
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, 595 - PAGE_MARGIN - 100, bottom, { width: 100, align: 'right' });
    doc.fillColor('#000000');
  }

  doc.end();
  return done;
}

function drawVectorSeal(doc, x, y, companyName) {
  // Fallback stamp when no real seal image is configured — a simple
  // vector "seal" so the document still visually carries a seal mark.
  doc.save();
  doc.lineWidth(1.2).circle(x + 45, y + 45, 42).stroke('#1a3c8c');
  doc.circle(x + 45, y + 45, 34).stroke('#1a3c8c');
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1a3c8c')
    .text((companyName || 'COMPANY SEAL').toUpperCase(), x, y + 38, { width: 90, align: 'center' });
  doc.fontSize(6).font('Helvetica').text('OFFICIAL SEAL', x, y + 50, { width: 90, align: 'center' });
  doc.fillColor('#000000');
  doc.restore();
}

module.exports = { buildDocumentPdf };
