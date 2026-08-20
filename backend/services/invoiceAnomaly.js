'use strict';
// services/invoiceAnomaly.js
//
// Invoice Anomaly Detection
// Flags: unusual amounts, duplicate invoices, missing POs, vendor anomalies, timing anomalies

const { safeQuery: query } = require('../db/pool');
const { createTask } = require('./tasks');
const { sendEmail } = require('./email');
const { logAction } = require('./auditLog');

// ──────────────────────────────────────────────────────────────────────────
// Detection Rules Configuration
// ──────────────────────────────────────────────────────────────────────────
const RULES = {
  // Amount-based anomalies
  amountZScore: 3,                    // Flag if amount > 3 std devs from vendor mean
  amountPercentile: 99,               // Flag top 1% amounts
  roundNumberThreshold: 0.95,         // Flag if >95% of amounts are round numbers (potential fabrication)

  // Duplicate detection
  duplicateWindowDays: 7,             // Look for duplicates within 7 days
  duplicateAmountTolerance: 0.01,     // 1% amount difference
  duplicateVendorMatch: true,         // Same vendor

  // PO anomalies
  requirePOAbove: 50000,              // Require PO for invoices > ₹50k
  poMatchTolerance: 0.02,             // PO amount must match within 2%

  // Timing anomalies
  weekendSubmission: true,            // Flag weekend/holiday submissions
  afterHoursSubmission: true,         // Flag submissions outside 9AM-6PM
  rapidSuccession: 3,                 // Flag 3+ invoices from same vendor in 1 hour

  // Vendor anomalies
  newVendorThreshold: 30,             // Flag invoices from vendors added <30 days ago
  vendorConcentration: 0.5,           // Flag if one vendor >50% of monthly spend

  // Sequential numbering
  checkSequential: true,              // Flag gaps in invoice numbers
};

// ──────────────────────────────────────────────────────────────────────────
// Main Detection Function
// ──────────────────────────────────────────────────────────────────────────
async function detectAnomalies(invoiceId = null) {
  const whereClause = invoiceId ? 'WHERE i.id = $1' : 'WHERE i.created_at > NOW() - INTERVAL \'30 days\'';
  const params = invoiceId ? [invoiceId] : [];

  const { rows: invoices } = await query(
    `SELECT i.*, p.name as vendor_name, p.gstin as vendor_gstin
     FROM invoices i
     JOIN parties p ON p.id = i.party_id
     ${whereClause}
     AND i.status IN ('draft', 'sent', 'approved')
     ORDER BY i.created_at DESC`,
    params
  );

  const allAnomalies = [];

  for (const inv of invoices) {
    const anomalies = await checkInvoice(inv);
    if (anomalies.length > 0) {
      allAnomalies.push({ invoice: inv, anomalies });
    }
  }

  return allAnomalies;
}

async function checkInvoice(inv) {
  const anomalies = [];

  // 1. Amount Anomaly - Z-Score
  const amountAnomaly = await checkAmountAnomaly(inv);
  if (amountAnomaly) anomalies.push(amountAnomaly);

  // 2. Duplicate Detection
  const duplicateAnomaly = await checkDuplicate(inv);
  if (duplicateAnomaly) anomalies.push(duplicateAnomaly);

  // 3. PO Requirements
  const poAnomaly = await checkPORequirement(inv);
  if (poAnomaly) anomalies.push(poAnomaly);

  // 4. Timing Anomalies
  const timingAnomaly = checkTimingAnomaly(inv);
  if (timingAnomaly) anomalies.push(timingAnomaly);

  // 5. Vendor Anomalies
  const vendorAnomaly = await checkVendorAnomaly(inv);
  if (vendorAnomaly) anomalies.push(vendorAnomaly);

  // 6. Sequential Number Gaps
  if (RULES.checkSequential) {
    const seqAnomaly = await checkSequentialGaps(inv);
    if (seqAnomaly) anomalies.push(seqAnomaly);
  }

  return anomalies;
}

// ──────────────────────────────────────────────────────────────────────────
// Individual Check Functions
// ──────────────────────────────────────────────────────────────────────────

async function checkAmountAnomaly(inv) {
  // Get vendor's historical invoice amounts (last 90 days, excluding current)
  const { rows } = await query(
    `SELECT amount FROM invoices
     WHERE party_id = $1 AND id != $2 AND status != 'cancelled'
       AND created_at > NOW() - INTERVAL '90 days'
     ORDER BY created_at DESC`,
    [inv.party_id, inv.id]
  );

  if (rows.length < 5) return null; // Need minimum history

  const amounts = rows.map(r => parseFloat(r.amount));
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const stdDev = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length);

  if (stdDev === 0) return null; // All same amount

  const zScore = Math.abs(parseFloat(inv.amount) - mean) / stdDev;
  const invoiceAmount = parseFloat(inv.amount);

  if (zScore >= RULES.amountZScore) {
    return {
      type: 'amount_anomaly',
      severity: zScore >= 4 ? 'critical' : 'high',
      title: `Unusual invoice amount (Z-score: ${zScore.toFixed(1)})`,
      description: `Invoice amount ${formatINR(invoiceAmount)} deviates ${zScore.toFixed(1)}σ from vendor mean ${formatINR(mean)} (σ=${formatINR(stdDev)})`,
      data: { invoiceAmount, mean, stdDev, zScore },
    };
  }

  // Check round number pattern
  const roundCount = amounts.filter(a => a % 1000 === 0 || a % 100 === 0).length;
  const roundPct = roundCount / amounts.length;
  if (roundPct >= RULES.roundNumberThreshold && invoiceAmount % 1000 === 0) {
    return {
      type: 'round_number_pattern',
      severity: 'medium',
      title: 'Potential round-number fabrication',
      description: `${(roundPct * 100).toFixed(0)}% of vendor's invoices are round numbers. This invoice (${formatINR(invoiceAmount)}) continues the pattern.`,
      data: { roundPercentage: roundPct },
    };
  }

  return null;
}

async function checkDuplicate(inv) {
  const { rows } = await query(
    `SELECT i.*, p.name as vendor_name
     FROM invoices i
     JOIN parties p ON p.id = i.party_id
     WHERE i.party_id = $1
       AND i.id != $2
       AND i.status != 'cancelled'
       AND i.created_at > NOW() - INTERVAL '${RULES.duplicateWindowDays} days'
       AND ABS(i.amount - $3) / $3 <= $4
     ORDER BY i.created_at DESC`,
    [inv.party_id, inv.id, parseFloat(inv.amount), RULES.duplicateAmountTolerance]
  );

  if (rows.length > 0) {
    const matches = rows.map(r => ({
      id: r.id,
      invoice_number: r.invoice_number,
      amount: r.amount,
      date: r.invoice_date,
      vendor: r.vendor_name,
    }));

    return {
      type: 'duplicate_invoice',
      severity: 'high',
      title: `Potential duplicate invoice(s) detected`,
      description: `Found ${matches.length} invoice(s) from same vendor within ${RULES.duplicateWindowDays} days with similar amount (±${(RULES.duplicateAmountTolerance * 100).toFixed(0)}%)`,
      data: { matches, invoiceAmount: parseFloat(inv.amount) },
    };
  }

  return null;
}

async function checkPORequirement(inv) {
  const amount = parseFloat(inv.amount);
  if (amount < RULES.requirePOAbove) return null;

  // Check if PO is linked
  const { rows } = await query(
    `SELECT 1 FROM purchase_orders WHERE invoice_id = $1 LIMIT 1`,
    [inv.id]
  );

  if (rows.length === 0) {
    return {
      type: 'missing_po',
      severity: amount >= RULES.requirePOAbove * 5 ? 'critical' : 'high',
      title: `Missing Purchase Order for high-value invoice`,
      description: `Invoice ${inv.invoice_number} (${formatINR(amount)}) exceeds ₹${RULES.requirePOAbove.toLocaleString()} threshold but has no linked PO`,
      data: { amount, threshold: RULES.requirePOAbove },
    };
  }

  // Check PO amount match
  const { rows: poRows } = await query(
    `SELECT total_amount FROM purchase_orders WHERE invoice_id = $1`,
    [inv.id]
  );

  if (poRows.length > 0) {
    const poAmount = parseFloat(poRows[0].total_amount);
    const diff = Math.abs(amount - poAmount) / amount;
    if (diff > RULES.poMatchTolerance) {
      return {
        type: 'po_amount_mismatch',
        severity: 'high',
        title: `PO amount mismatch`,
        description: `Invoice ${inv.invoice_number} (${formatINR(amount)}) differs from PO by ${(diff * 100).toFixed(1)}%`,
        data: { invoiceAmount: amount, poAmount, diffPercentage: diff * 100 },
      };
    }
  }

  return null;
}

function checkTimingAnomaly(inv) {
  const created = new Date(inv.created_at);
  const anomalies = [];

  // Weekend submission
  if (RULES.weekendSubmission && (created.getDay() === 0 || created.getDay() === 6)) {
    anomalies.push({
      type: 'weekend_submission',
      severity: 'low',
      title: 'Invoice submitted on weekend',
      description: `Invoice ${inv.invoice_number} created on ${created.toLocaleDateString('en-IN', { weekday: 'long' })}`,
    });
  }

  // After hours
  if (RULES.afterHoursSubmission && (created.getHours() < 9 || created.getHours() >= 18)) {
    anomalies.push({
      type: 'after_hours_submission',
      severity: 'low',
      title: 'Invoice submitted outside business hours',
      description: `Invoice ${inv.invoice_number} created at ${created.toLocaleTimeString('en-IN')}`,
    });
  }

  // Rapid succession (check in caller with other invoices)
  // This would be checked in batch

  return anomalies.length > 0 ? {
    type: 'timing_anomaly',
    severity: 'medium',
    title: 'Timing anomalies detected',
    description: anomalies.map(a => a.title).join('; '),
    data: { anomalies },
  } : null;
}

async function checkVendorAnomaly(inv) {
  const anomalies = [];

  // New vendor check
  const { rows: vendor } = await query(
    `SELECT created_at FROM parties WHERE id = $1`,
    [inv.party_id]
  );

  if (vendor.length > 0) {
    const vendorAge = (Date.now() - new Date(vendor[0].created_at).getTime()) / 86400000;
    if (vendorAge < RULES.newVendorThreshold) {
      anomalies.push({
        type: 'new_vendor',
        severity: 'medium',
        title: `Invoice from recently added vendor`,
        description: `Vendor "${inv.vendor_name}" was added ${Math.round(vendorAge)} days ago`,
      });
    }
  }

  // Vendor concentration check (monthly)
  const { rows: monthly } = await query(
    `SELECT SUM(amount) as vendor_total,
      (SELECT SUM(amount) FROM invoices WHERE created_at > NOW() - INTERVAL '30 days' AND status != 'cancelled') as monthly_total
     FROM invoices
     WHERE party_id = $1 AND created_at > NOW() - INTERVAL '30 days' AND status != 'cancelled'`,
    [inv.party_id]
  );

  if (monthly.length > 0) {
    const vendorTotal = parseFloat(monthly[0].vendor_total || 0);
    const monthlyTotal = parseFloat(monthly[0].monthly_total || 1);
    const concentration = vendorTotal / monthlyTotal;

    if (concentration >= RULES.vendorConcentration) {
      anomalies.push({
        type: 'vendor_concentration',
        severity: 'high',
        title: `High vendor concentration risk`,
        description: `Vendor "${inv.vendor_name}" represents ${(concentration * 100).toFixed(1)}% of this month's spend (${formatINR(vendorTotal)} of ${formatINR(monthlyTotal)})`,
        data: { concentration, vendorTotal, monthlyTotal },
      });
    }
  }

  return anomalies.length > 0 ? {
    type: 'vendor_anomaly',
    severity: anomalies.some(a => a.severity === 'high') ? 'high' : 'medium',
    title: 'Vendor anomalies detected',
    description: anomalies.map(a => a.title).join('; '),
    data: { anomalies },
  } : null;
}

async function checkSequentialGaps(inv) {
  if (!inv.invoice_number) return null;

  // Extract numeric part
  const match = inv.invoice_number.match(/(\d+)$/);
  if (!match) return null;

  const currentNum = parseInt(match[1]);
  const prefix = inv.invoice_number.replace(match[1], '');

  // Find previous and next numbers
  const { rows } = await query(
    `SELECT invoice_number FROM invoices
     WHERE invoice_number LIKE $1 AND id != $2
     ORDER BY invoice_number`,
    [`${prefix}%`, inv.id]
  );

  const numbers = rows.map(r => {
    const m = r.invoice_number.match(/(\d+)$/);
    return m ? parseInt(m[1]) : null;
  }).filter(n => n !== null).sort((a, b) => a - b);

  // Find gaps around current number
  const idx = numbers.indexOf(currentNum);
  const gaps = [];

  if (idx > 0 && currentNum - numbers[idx - 1] > 1) {
    gaps.push({ from: numbers[idx - 1], to: currentNum - 1, count: currentNum - numbers[idx - 1] - 1 });
  }
  if (idx < numbers.length - 1 && numbers[idx + 1] - currentNum > 1) {
    gaps.push({ from: currentNum + 1, to: numbers[idx + 1] - 1, count: numbers[idx + 1] - currentNum - 1 });
  }

  if (gaps.length > 0) {
    return {
      type: 'sequential_gap',
      severity: 'medium',
      title: 'Gaps in invoice numbering sequence',
      description: `Invoice ${inv.invoice_number} has ${gaps.length} gap(s) in sequence: ${gaps.map(g => `${g.from}-${g.to} (${g.count} missing)`).join(', ')}`,
      data: { gaps, currentNumber: currentNum },
    };
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Batch Detection (for scheduled runs)
// ──────────────────────────────────────────────────────────────────────────
async function runBatchDetection() {
  console.log('[invoiceAnomaly] Running batch detection...');

  const allAnomalies = await detectAnomalies();

  // Group by severity
  const bySeverity = { critical: [], high: [], medium: [], low: [] };
  for (const item of allAnomalies) {
    for (const a of item.anomalies) {
      bySeverity[a.severity].push({ invoice: item.invoice, anomaly: a });
    }
  }

  // Create tasks for high/critical
  for (const item of [...bySeverity.critical, ...bySeverity.high]) {
    await createTask({
      title: `Invoice Anomaly: ${item.anomaly.title}`,
      description: `${item.anomaly.description}\nInvoice: ${item.invoice.invoice_number} (${formatINR(item.invoice.amount)})\nVendor: ${item.invoice.vendor_name}`,
      priority: item.anomaly.severity === 'critical' ? 'urgent' : 'high',
      relatedEntity: 'invoice',
      relatedEntityId: item.invoice.id,
      tags: ['anomaly', item.anomaly.type],
    });
  }

  // Send summary email
  const total = Object.values(bySeverity).flat().length;
  if (total > 0) {
    await sendEmail({
      to: process.env.ANOMALY_ALERT_EMAIL || 'finance@ethertrack.in',
      subject: `Invoice Anomaly Report: ${total} anomalies (${bySeverity.critical.length} critical, ${bySeverity.high.length} high)`,
      html: generateAnomalyReport(bySeverity),
    }).catch(e => console.error('[invoiceAnomaly] Email failed:', e.message));
  }

  console.log(`[invoiceAnomaly] Batch complete: ${total} anomalies found`);
  return { total, bySeverity };
}

function generateAnomalyReport(bySeverity) {
  let html = '<h2>Invoice Anomaly Detection Report</h2>';
  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;
    const color = severity === 'critical' ? '#e5484d' : severity === 'high' ? '#e5a54b' : severity === 'medium' ? '#5aa9e6' : '#2fbf71';
    html += `<h3 style="color: ${color}">${severity.toUpperCase()} (${items.length})</h3><ul>`;
    for (const item of items.slice(0, 10)) {
      html += `<li><strong>${item.invoice.invoice_number}</strong> (${formatINR(item.invoice.amount)}) - ${item.anomaly.title}: ${item.anomaly.description}</li>`;
    }
    if (items.length > 10) html += `<li>...and ${items.length - 10} more</li>`;
    html += '</ul>';
  }
  return html;
}

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

module.exports = {
  detectAnomalies,
  checkInvoice,
  runBatchDetection,
  RULES,
  formatINR,
};