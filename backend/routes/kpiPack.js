'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const kpiPack = require('../services/kpiPack');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'finance'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/kpi-pack — Get all KPI data as JSON
// ──────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const data = await kpiPack.generateKPIPackData();
    res.json(data);
  } catch (err) {
    console.error('[kpi-pack:data]', err);
    res.status(500).json({ error: 'Failed to generate KPI pack' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/kpi-pack/pdf — Generate and download PDF
// ──────────────────────────────────────────────────────────────────────────
router.get('/pdf', async (req, res) => {
  try {
    const data = await kpiPack.generateKPIPackData();
    const docDefinition = kpiPack.generatePDFDefinition(data);

    // Use pdfmake to generate PDF
    const pdfMake = require('pdfmake/build/pdfmake');
    const pdfFonts = require('pdfmake/build/vfs_fonts');
    pdfMake.vfs = pdfFonts.pdfMake.vfs;

    const pdfDoc = pdfMake.createPdf(docDefinition);
    const pdfBuffer = await new Promise((resolve, reject) => {
      pdfDoc.getBuffer((buffer) => resolve(buffer));
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kpi-pack-${data.period}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[kpi-pack:pdf]', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/kpi-pack/dashboard — Dashboard summary
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const data = await kpiPack.generateKPIPackData();
    res.json({ kpis: data.kpis, period: data.period });
  } catch (err) {
    console.error('[kpi-pack:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

module.exports = router;