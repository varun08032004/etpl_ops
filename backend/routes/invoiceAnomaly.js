'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const anomaly = require('../services/invoiceAnomaly');

router.use(authenticate);
router.use(requireRole('owner', 'admin', 'finance', 'accounting_hod'));

// ──────────────────────────────────────────────────────────────────────────
// GET /api/invoice-anomalies — List all anomalies
// ──────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.type) filters.type = req.query.type;
    if (req.query.status) filters.status = req.query.status;

    // For now, run detection on recent invoices
    // In production, would query pre-computed anomaly table
    const allAnomalies = await anomaly.detectAnomalies();

    // Flatten and filter
    let flat = [];
    for (const item of allAnomalies) {
      for (const a of item.anomalies) {
        flat.push({
          ...a,
          invoiceId: item.invoice.id,
          invoiceNumber: item.invoice.invoice_number,
          vendorName: item.invoice.vendor_name,
          amount: item.invoice.amount,
          invoiceDate: item.invoice.invoice_date,
          createdAt: item.invoice.created_at,
        });
      }
    }

    // Apply filters
    if (filters.severity) flat = flat.filter(a => a.severity === filters.severity);
    if (filters.type) flat = flat.filter(a => a.type === filters.type);

    // Sort by severity (critical first) then date
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    flat.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({ anomalies: flat, total: flat.length });
  } catch (err) {
    console.error('[invoice-anomalies:list]', err);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/invoice-anomalies/dashboard — Summary stats
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const allAnomalies = await anomaly.detectAnomalies();

    let flat = [];
    for (const item of allAnomalies) {
      for (const a of item.anomalies) {
        flat.push({ ...a, invoiceId: item.invoice.id });
      }
    }

    const stats = {
      total: flat.length,
      critical: flat.filter(a => a.severity === 'critical').length,
      high: flat.filter(a => a.severity === 'high').length,
      medium: flat.filter(a => a.severity === 'medium').length,
      low: flat.filter(a => a.severity === 'low').length,
      byType: {},
    };

    for (const a of flat) {
      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
    }

    res.json(stats);
  } catch (err) {
    console.error('[invoice-anomalies:dashboard]', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/invoice-anomalies/:invoiceId — Check specific invoice
// ──────────────────────────────────────────────────────────────────────────
router.get('/:invoiceId', async (req, res) => {
  try {
    const { safeQuery: query } = require('../db/pool');
    const { rows: [inv] } = await query(
      `SELECT i.*, p.name as vendor_name FROM invoices i JOIN parties p ON p.id = i.party_id WHERE i.id = $1`,
      [req.params.invoiceId]
    );

    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const anomalies = await anomaly.checkInvoice(inv);
    res.json({ invoice: inv, anomalies });
  } catch (err) {
    console.error('[invoice-anomalies:check]', err);
    res.status(500).json({ error: 'Failed to check invoice' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/invoice-anomalies/run — Manual trigger for batch detection
// ──────────────────────────────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  try {
    const result = await anomaly.runBatchDetection();
    res.json(result);
  } catch (err) {
    console.error('[invoice-anomalies:run]', err);
    res.status(500).json({ error: 'Failed to run detection' });
  }
});

module.exports = router;