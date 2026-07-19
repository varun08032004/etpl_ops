'use strict';

// ============================================================================
// PAYSLIP PDF GENERATOR
// ============================================================================
// Generates a payslip PDF on demand — nothing is stored on disk. Called by
// routes/payroll.js for both the finance-facing download and the employee
// self-service download. Returns a Buffer; the route decides how to send it.
//
// Company details come from env vars so this file never needs editing per-company:
//   COMPANY_NAME, COMPANY_ADDRESS, COMPANY_PAN (optional), COMPANY_GSTIN (optional)
// Falls back to placeholders if unset, so it never crashes — but you'll want
// these set for anything you actually hand to an employee.
// ============================================================================

const PDFDocument = require('pdfkit'); // npm install pdfkit

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatINR(amount) {
  const n = Number(amount || 0);
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Note: deliberately spelling "Rs." instead of the ₹ glyph — pdfkit's built-in
  // fonts don't reliably render the rupee symbol and it can come out as a box.
}

/**
 * @param {object} params
 * @param {object} params.run    - payroll_runs row (period_month, period_year)
 * @param {object} params.item   - payroll_items row joined with employee fields
 *   (full_name, employee_code, designation, pan_number if available, basic, hra,
 *    other_allowances, da_amount, gross_pay, pf_deduction, esic_employee_deduction,
 *    professional_tax, tds_deduction, loss_of_pay_days, net_pay)
 * @returns {Promise<Buffer>}
 */
function generatePayslipPDF({ run, item }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const companyName = process.env.COMPANY_NAME || 'Your Company Name (set COMPANY_NAME env var)';
      const companyAddress = process.env.COMPANY_ADDRESS || '';
      const companyPAN = process.env.COMPANY_PAN || '';
      const companyGSTIN = process.env.COMPANY_GSTIN || '';

      // ── Header ──
      doc.fontSize(16).font('Helvetica-Bold').text(companyName);
      if (companyAddress) doc.fontSize(9).font('Helvetica').fillColor('#555555').text(companyAddress);
      const regLine = [companyPAN && `PAN: ${companyPAN}`, companyGSTIN && `GSTIN: ${companyGSTIN}`].filter(Boolean).join('   ');
      if (regLine) doc.fontSize(9).text(regLine);
      doc.fillColor('#000000');
      doc.moveDown(0.8);

      doc.fontSize(13).font('Helvetica-Bold').text(`Payslip for ${MONTHS[run.period_month - 1]} ${run.period_year}`, { align: 'center' });
      doc.moveDown(1);

      // ── Employee details block ──
      const leftX = 50, rightX = 320, labelWidth = 100;
      const startY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').text('Employee Name:', leftX, startY, { continued: false });
      doc.font('Helvetica').text(item.full_name || '-', leftX + labelWidth, startY);

      doc.font('Helvetica-Bold').text('Employee Code:', rightX, startY);
      doc.font('Helvetica').text(item.employee_code || '-', rightX + labelWidth, startY);

      const row2Y = startY + 18;
      doc.font('Helvetica-Bold').text('Designation:', leftX, row2Y);
      doc.font('Helvetica').text(item.designation || '-', leftX + labelWidth, row2Y);

      doc.font('Helvetica-Bold').text('PAN:', rightX, row2Y);
      doc.font('Helvetica').text(item.pan_number || '-', rightX + labelWidth, row2Y);

      const row3Y = row2Y + 18;
      doc.font('Helvetica-Bold').text('Loss of Pay Days:', leftX, row3Y);
      doc.font('Helvetica').text(String(item.loss_of_pay_days || 0), leftX + labelWidth, row3Y);

      doc.y = row3Y + 30;

      // ── Earnings / Deductions table ──
      const tableTop = doc.y;
      const col1 = 50, col2 = 300, colWidth = 245;

      function tableHeader(y, leftLabel, rightLabel) {
        doc.rect(col1, y, colWidth, 20).fill('#f0f0f0');
        doc.rect(col2, y, colWidth, 20).fill('#f0f0f0');
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
        doc.text(leftLabel, col1 + 8, y + 5);
        doc.text(rightLabel, col2 + 8, y + 5);
      }

      function tableRow(y, leftLabel, leftValue, rightLabel, rightValue) {
        doc.fontSize(9.5).font('Helvetica');
        if (leftLabel) { doc.text(leftLabel, col1 + 8, y); doc.text(leftValue, col1 + 8, y, { width: colWidth - 16, align: 'right' }); }
        if (rightLabel) { doc.text(rightLabel, col2 + 8, y); doc.text(rightValue, col2 + 8, y, { width: colWidth - 16, align: 'right' }); }
      }

      tableHeader(tableTop, 'Earnings', 'Deductions');
      let y = tableTop + 28;
      const rowHeight = 18;

      const earnings = [
        ['Basic', item.basic],
        ['HRA', item.hra],
        ['DA', item.da_amount],
        ['Other Allowances', item.other_allowances],
      ].filter(([, v]) => Number(v) !== 0);

      const deductions = [
        ['Provident Fund (PF)', item.pf_deduction],
        ['ESIC', item.esic_employee_deduction],
        ['Professional Tax', item.professional_tax],
        ['TDS (Sec 192)', item.tds_deduction],
      ].filter(([, v]) => Number(v) !== 0);

      const maxRows = Math.max(earnings.length, deductions.length);
      for (let i = 0; i < maxRows; i++) {
        const e = earnings[i], d = deductions[i];
        tableRow(y, e ? e[0] : '', e ? formatINR(e[1]) : '', d ? d[0] : '', d ? formatINR(d[1]) : '');
        y += rowHeight;
      }

      // Totals row
      doc.moveTo(col1, y).lineTo(col1 + colWidth, y).stroke('#cccccc');
      doc.moveTo(col2, y).lineTo(col2 + colWidth, y).stroke('#cccccc');
      y += 6;
      doc.font('Helvetica-Bold').fontSize(9.5);
      const totalDeductions = deductions.reduce((s, [, v]) => s + Number(v || 0), 0);
      tableRow(y, 'Gross Earnings', formatINR(item.gross_pay), 'Total Deductions', formatINR(totalDeductions));
      y += rowHeight + 15;

      // ── Net Pay banner ──
      doc.rect(col1, y, colWidth * 2 + (col2 - col1 - colWidth), 32).fill('#e8f5e9');
      doc.fillColor('#1b5e20').fontSize(12).font('Helvetica-Bold');
      doc.text('NET PAY', col1 + 12, y + 9);
      doc.fontSize(13).text(formatINR(item.net_pay), col1, y + 9, { width: colWidth * 2 + (col2 - col1 - colWidth) - 12, align: 'right' });
      doc.fillColor('#000000');

      y += 32 + 30;

      // ── Footer ──
      doc.fontSize(8).font('Helvetica').fillColor('#888888')
        .text('This is a computer-generated payslip and does not require a signature.', 50, y, { align: 'center', width: 495 });
      doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, 50, y + 12, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePayslipPDF };