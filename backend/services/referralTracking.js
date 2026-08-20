'use strict';
// services/referralTracking.js
//
// Internal Referral Tracking
// Track CA/consultant referrals, commissions, payouts, and performance

const { safeQuery: query } = require('../db/pool');
const { createTask } = require('./tasks');
const { sendEmail } = require('./email');
const { logAction } = require('./auditLog');

// ──────────────────────────────────────────────────────────────────────────
// Referral Types & Commission Structures
// ──────────────────────────────────────────────────────────────────────────
const REFERRAL_TYPES = {
  ca_firm: { name: 'CA Firm', baseCommission: 0.10, tiers: { 0: 0.10, 5: 0.12, 10: 0.15 } }, // 10/12/15% based on referrals
  audit_firm: { name: 'Audit Firm', baseCommission: 0.08, tiers: { 0: 0.08, 5: 0.10, 10: 0.12 } },
  esg_consultancy: { name: 'ESG Consultancy', baseCommission: 0.12, tiers: { 0: 0.12, 3: 0.15, 5: 0.18 } },
  law_firm: { name: 'Law Firm', baseCommission: 0.10, tiers: { 0: 0.10, 3: 0.12, 5: 0.15 } },
  channel_partner: { name: 'Channel Partner', baseCommission: 0.15, tiers: { 0: 0.15, 5: 0.18, 10: 0.20 } },
  employee: { name: 'Employee Referral', baseCommission: 0.05, tiers: { 0: 0.05, 5: 0.07 } },
  other: { name: 'Other', baseCommission: 0.08, tiers: { 0: 0.08 } },
};

const REFERRAL_STAGES = ['submitted', 'qualified', 'demo_scheduled', 'proposal_sent', 'won', 'lost'];
const PAYOUT_STATUS = ['pending', 'approved', 'paid', 'cancelled'];

// ──────────────────────────────────────────────────────────────────────────
// Create Referral
// ──────────────────────────────────────────────────────────────────────────
async function createReferral(data) {
  const {
    referrer_type, referrer_id, referrer_name, referrer_email,
    lead_name, lead_company, lead_email, lead_phone,
    lead_source, estimated_value, notes,
    created_by,
  } = data;

  const referralType = REFERRAL_TYPES[referrer_type] || REFERRAL_TYPES.other;
  const commissionRate = referralType.baseCommission;

  const { rows: [referral] } = await query(
    `INSERT INTO referrals
       (referrer_type, referrer_id, referrer_name, referrer_email,
        lead_name, lead_company, lead_email, lead_phone,
        lead_source, estimated_value, commission_rate, notes, created_by, stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'submitted')
     RETURNING *`,
    [
      referrer_type, referrer_id, referrer_name, referrer_email,
      lead_name, lead_company, lead_email, lead_phone,
      lead_source, estimated_value, commissionRate, notes, created_by,
    ]
  );

  // Notify assigned sales rep
  await createTask({
    title: `New Referral: ${lead_name} (${lead_company})`,
    description: `Referral from ${referrer_name} (${referrer_type}). Estimated value: ${formatINR(estimated_value)}. Commission: ${(commissionRate * 100).toFixed(1)}%`,
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), // 2 days
    assignedTo: await getAssignedRep(lead_source),
    relatedEntity: 'referral',
    relatedEntityId: referral.id,
    priority: 'high',
    tags: ['referral', referrer_type],
  });

  // Log
  await logAction({
    staffId: created_by,
    action: 'referral.created',
    entity: 'referral',
    entityId: referral.id,
    newValue: { referrer_type, lead_name, lead_company, estimated_value, commissionRate },
  }).catch(() => {});

  return referral;
}

async function getAssignedRep(source) {
  // Simple round-robin or source-based assignment
  const { rows } = await query(
    `SELECT s.id FROM staff_accounts s
     JOIN employees e ON e.id = s.employee_id
     WHERE e.department = 'Sales' AND e.status = 'active' AND s.is_active = true
     ORDER BY RANDOM() LIMIT 1`
  );
  return rows[0]?.id;
}

// ──────────────────────────────────────────────────────────────────────────
// Update Referral Stage
// ──────────────────────────────────────────────────────────────────────────
async function updateReferralStage(referralId, stage, updatedBy, metadata = {}) {
  const validStages = REFERRAL_STAGES;
  if (!validStages.includes(stage)) throw new Error('Invalid stage');

  const { rows: [referral] } = await query(
    `UPDATE referrals SET stage = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [stage, referralId]
  );

  if (!referral) throw new Error('Referral not found');

  // If won, create commission record
  if (stage === 'won') {
    await createCommission(referralId, updatedBy);
  }

  // Log
  await logAction({
    staffId: updatedBy,
    action: 'referral.stage_changed',
    entity: 'referral',
    entityId: referralId,
    newValue: { stage, ...metadata },
  }).catch(() => {});

  return referral;
}

// ──────────────────────────────────────────────────────────────────────────
// Commission Management
// ──────────────────────────────────────────────────────────────────────────
async function createCommission(referralId, createdBy) {
  const { rows: [referral] } = await query(
    `SELECT * FROM referrals WHERE id = $1`, [referralId]
  );

  if (!referral) throw new Error('Referral not found');

  const commissionAmount = Math.round(parseFloat(referral.estimated_value) * parseFloat(referral.commission_rate));

  // Calculate tier bonus
  const referrerType = REFERRAL_TYPES[referral.referrer_type] || REFERRAL_TYPES.other;
  const { rows: stats } = await query(
    `SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1 AND stage = 'won'`,
    [referral.referrer_id]
  );
  const referralCount = parseInt(stats[0]?.count || 0);

  let tierBonus = 0;
  if (referrerType.tiers) {
    for (const [threshold, rate] of Object.entries(referrerType.tiers).sort((a, b) => b[0] - a[0])) {
      if (referralCount >= parseInt(threshold)) {
        tierBonus = Math.round(parseFloat(referral.estimated_value) * (rate - referralType.baseCommission));
        break;
      }
    }
  }

  const { rows: [commission] } = await query(
    `INSERT INTO referral_commissions
       (referral_id, referrer_id, referrer_type, base_amount, tier_bonus, total_amount, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
     RETURNING *`,
    [referralId, referral.referrer_id, referral.referrer_type, commissionAmount, tierBonus, commissionAmount + tierBonus, createdBy]
  );

  return commission;
}

// ──────────────────────────────────────────────────────────────────────────
// Approve/Pay Commission
// ──────────────────────────────────────────────────────────────────────────
async function approveCommission(commissionId, approvedBy) {
  const { rows: [commission] } = await query(
    `UPDATE referral_commissions SET status = 'approved', approved_by = $1, approved_at = NOW()
     WHERE id = $2 AND status = 'pending' RETURNING *`,
    [approvedBy, commissionId]
  );
  return commission;
}

async function payCommission(commissionId, paidBy, paymentReference) {
  const { rows: [commission] } = await query(
    `UPDATE referral_commissions SET status = 'paid', paid_by = $1, paid_at = NOW(), payment_reference = $2
     WHERE id = $3 AND status = 'approved' RETURNING *`,
    [paidBy, paymentReference, commissionId]
  );

  if (commission) {
    // Log payment
    await logAction({
      staffId: paidBy,
      action: 'referral_commission.paid',
      entity: 'referral_commission',
      entityId: commissionId,
      newValue: { paymentReference, amount: commission.total_amount },
    }).catch(() => {});
  }
  return commission;
}

// ──────────────────────────────────────────────────────────────────────────
// Get Referrals with Filters
// ──────────────────────────────────────────────────────────────────────────
async function getReferrals(filters = {}) {
  let sql = `
    SELECT r.*, 
      rc.total_amount as commission_amount,
      rc.status as commission_status,
      e.full_name as created_by_name
    FROM referrals r
    LEFT JOIN referral_commissions rc ON rc.referral_id = r.id
    LEFT JOIN employees e ON e.id = r.created_by
    WHERE 1=1
  `;
  const params = [];
  let paramIdx = 1;

  if (filters.referrerType) { params.push(filters.referrerType); sql += ` AND r.referrer_type = $${paramIdx++}`; }
  if (filters.stage) { params.push(filters.stage); sql += ` AND r.stage = $${paramIdx++}`; }
  if (filters.referrerId) { params.push(filters.referrerId); sql += ` AND r.referrer_id = $${paramIdx++}`; }
  if (filters.fromDate) { params.push(filters.fromDate); sql += ` AND r.created_at >= $${paramIdx++}`; }
  if (filters.toDate) { params.push(filters.toDate); sql += ` AND r.created_at <= $${paramIdx++}`; }
  if (filters.commissionStatus) { params.push(filters.commissionStatus); sql += ` AND rc.status = $${paramIdx++}`; }

  sql += ` ORDER BY r.created_at DESC LIMIT 200`;

  const { rows } = await query(sql, params);
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Get Referral Dashboard Stats
// ──────────────────────────────────────────────────────────────────────────
async function getReferralDashboard() {
  const { rows: [stats] } = await query(
    `SELECT 
      COUNT(*) as total_referrals,
      COUNT(*) FILTER (WHERE stage = 'won') as won,
      COUNT(*) FILTER (WHERE stage = 'lost') as lost,
      COUNT(*) FILTER (WHERE stage IN ('submitted', 'qualified', 'demo_scheduled', 'proposal_sent')) as active,
      SUM(estimated_value) FILTER (WHERE stage = 'won') as total_won_value,
      SUM(estimated_value) as total_pipeline_value,
      AVG(estimated_value) FILTER (WHERE stage = 'won') as avg_deal_size
     FROM referrals`
  );

  const { rows: byType } = await query(
    `SELECT referrer_type, COUNT(*) as count, SUM(estimated_value) FILTER (WHERE stage = 'won') as won_value
     FROM referrals GROUP BY referrer_type ORDER BY count DESC`
  );

  const { rows: byStage } = await query(
    `SELECT stage, COUNT(*) as count FROM referrals GROUP BY stage ORDER BY count DESC`
  );

  const { rows: topReferrers } = await query(
    `SELECT referrer_name, referrer_type, COUNT(*) as referrals, SUM(estimated_value) FILTER (WHERE stage = 'won') as won_value
     FROM referrals GROUP BY referrer_name, referrer_type ORDER BY won_value DESC NULLS LAST LIMIT 10`
  );

  const { rows: pendingCommissions } = await query(
    `SELECT SUM(total_amount) as total FROM referral_commissions WHERE status = 'pending'`
  );

  const { rows: paidCommissions } = await query(
    `SELECT SUM(total_amount) as total FROM referral_commissions WHERE status = 'paid'`
  );

  return {
    ...stats[0],
    byType,
    byStage,
    topReferrers,
    pendingCommissions: parseFloat(pendingCommissions[0]?.total || 0),
    paidCommissions: parseFloat(paidCommissions[0]?.total || 0),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Get Commission Details
// ──────────────────────────────────────────────────────────────────────────
async function getCommissions(filters = {}) {
  let sql = `
    SELECT rc.*, r.lead_name, r.lead_company, r.referrer_name, r.referrer_type
    FROM referral_commissions rc
    JOIN referrals r ON r.id = rc.referral_id
    WHERE 1=1
  `;
  const params = [];
  let paramIdx = 1;

  if (filters.status) { params.push(filters.status); sql += ` AND rc.status = $${paramIdx++}`; }
  if (filters.referrerId) { params.push(filters.referrerId); sql += ` AND rc.referrer_id = $${paramIdx++}`; }

  sql += ` ORDER BY rc.created_at DESC LIMIT 200`;

  const { rows } = await query(sql, params);
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Referrer Performance
// ──────────────────────────────────────────────────────────────────────────
async function getReferrerPerformance(referrerId) {
  const { rows: referrals } = await query(
    `SELECT * FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC`, [referrerId]
  );

  const { rows: commissions } = await query(
    `SELECT * FROM referral_commissions WHERE referrer_id = $1 ORDER BY created_at DESC`, [referrerId]
  );

  const totalReferrals = referrals.length;
  const wonReferrals = referrals.filter(r => r.stage === 'won').length;
  const totalWonValue = referrals.filter(r => r.stage === 'won').reduce((sum, r) => sum + parseFloat(r.estimated_value || 0), 0);
  const totalCommission = commissions.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
  const paidCommission = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
  const pendingCommission = commissions.filter(c => c.status === 'pending' || c.status === 'approved').reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);

  return {
    referrerId,
    totalReferrals,
    wonReferrals,
    conversionRate: totalReferrals ? (wonReferrals / totalReferrals * 100).toFixed(1) : 0,
    totalWonValue,
    totalCommission,
    paidCommission,
    pendingCommission,
    referrals,
    commissions,
  };
}

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

module.exports = {
  createReferral,
  updateReferralStage,
  createCommission,
  approveCommission,
  payCommission,
  getReferrals,
  getReferralDashboard,
  getCommissions,
  getReferrerPerformance,
  REFERRAL_TYPES,
  REFERRAL_STAGES,
  PAYOUT_STATUS,
  formatINR,
};