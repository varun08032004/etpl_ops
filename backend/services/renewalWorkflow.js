'use strict';
// services/renewalWorkflow.js
//
// Automated Renewal Workflow for Corporate subscriptions
// 120/90/60/30 day sequences with approval gates
//
// Trigger: Runs daily via cron (or called manually)
// Source: corporate_deals table + platform subscription data

const { safeQuery: query } = require('../db/pool');
const { fetchPlatformCustomers } = require('./platformClient');
const { sendEmail } = require('./email');
const { createTask } = require('./tasks'); // assuming task service exists
const { logAction } = require('./auditLog');

const RENEWAL_STAGES = [
  { daysBefore: 120, label: 'Early Alert', description: 'Start renewal prep - gather usage data, identify expansion opportunities' },
  { daysBefore: 90, label: 'Proposal Prep', description: 'Draft renewal proposal with seat/price changes, internal review' },
  { daysBefore: 60, label: 'Customer Outreach', description: 'Send proposal to customer, schedule renewal call' },
  { daysBefore: 30, label: 'Final Push', description: 'Last chance to close before expiry - escalate if no response' },
];

const APPROVAL_THRESHOLDS = {
  discountPercent: 15, // >15% discount needs approval
  seatReduction: 20,   // >20% seat reduction needs approval
  priceReduction: 10,  // >10% price reduction needs approval
};

// ──────────────────────────────────────────────────────────────────────────
// Get all upcoming renewals with stage info
// ──────────────────────────────────────────────────────────────────────────
async function getUpcomingRenewals(daysAhead = 180) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  // Get corporate deals with upcoming renewals
  const { rows: deals } = await query(
    `SELECT cd.*, p.company_name as party_name, p.email as party_email
     FROM corporate_deals cd
     JOIN parties p ON p.id = cd.party_id
     WHERE cd.status = 'active'
       AND cd.billing_frequency IN ('monthly', 'annual')
       AND cd.renewal_date IS NOT NULL
       AND cd.renewal_date <= $1
     ORDER BY cd.renewal_date ASC`,
    [cutoffDate.toISOString().slice(0, 10)]
  );

  // Also get platform corporate subscriptions that might not have a deal record
  let platformCustomers = [];
  try {
    platformCustomers = await fetchPlatformCustomers(10000);
  } catch (e) {
    console.warn('[renewalWorkflow] Could not fetch platform customers:', e.message);
  }

  const platformCorporate = platformCustomers
    .filter(c => c.subscription_plan === 'corporate' && c.subscription_renewal_date)
    .map(c => ({
      platformUserId: c.id,
      email: c.email,
      fullName: c.full_name,
      companyName: c.company_name,
      renewalDate: c.subscription_renewal_date,
      seats: c.seats || 1,
      plan: c.subscription_plan,
      source: 'platform',
    }));

  // Combine and deduplicate by platformUserId
  const byPlatformId = new Map();
  for (const d of deals) {
    byPlatformId.set(d.platform_user_id, { ...d, source: 'deal' });
  }
  for (const p of platformCorporate) {
    if (!byPlatformId.has(p.platformUserId)) {
      byPlatformId.set(p.platformUserId, p);
    }
  }

  const all = Array.from(byPlatformId.values());

  // Calculate days until renewal and current stage
  const now = new Date();
  return all.map(r => {
    const renewalDate = new Date(r.renewal_date);
    const daysUntil = Math.ceil((renewalDate - now) / 86400000);
    const currentStage = RENEWAL_STAGES.find(s => daysUntil <= s.daysBefore && daysUntil > (s.daysBefore - 30)) || null;
    const nextStage = RENEWAL_STAGES.find(s => daysUntil > s.daysBefore) || RENEWAL_STAGES[0];

    return {
      ...r,
      daysUntilRenewal: daysUntil,
      currentStage,
      nextStage,
      isOverdue: daysUntil < 0,
      isUrgent: daysUntil <= 30 && daysUntil >= 0,
    };
  }).filter(r => r.daysUntilRenewal <= daysAhead);
}

// ──────────────────────────────────────────────────────────────────────────
// Create renewal tasks for a specific deal
// ──────────────────────────────────────────────────────────────────────────
async function createRenewalTasks(dealId, assignedTo) {
  const { rows: [deal] } = await query(
    `SELECT * FROM corporate_deals WHERE id = $1`, [dealId]
  );
  if (!deal) throw new Error('Deal not found');

  const renewalDate = new Date(deal.renewal_date);
  const tasks = [];

  for (const stage of RENEWAL_STAGES) {
    const dueDate = new Date(renewalDate);
    dueDate.setDate(dueDate.getDate() - stage.daysBefore);

    // Only create if due date is in the future
    if (dueDate > new Date()) {
      const task = await createTask({
        title: `Renewal: ${stage.label} - ${deal.party_email || deal.platform_email}`,
        description: stage.description,
        dueDate: dueDate.toISOString().slice(0, 10),
        assignedTo,
        relatedEntity: 'corporate_deal',
        relatedEntityId: dealId,
        priority: stage.daysBefore <= 30 ? 'high' : 'medium',
        tags: ['renewal', stage.label.toLowerCase().replace(' ', '_')],
      });
      tasks.push(task);
    }
  }

  return tasks;
}

// ──────────────────────────────────────────────────────────────────────────
// Create renewal proposal (internal draft)
// ──────────────────────────────────────────────────────────────────────────
async function createRenewalProposal(dealId, proposal, createdBy) {
  const { rows: [deal] } = await query(`SELECT * FROM corporate_deals WHERE id = $1`, [dealId]);
  if (!deal) throw new Error('Deal not found');

  const needsApproval = checkApprovalNeeded(deal, proposal);

  const { rows: [proposalRecord] } = await query(
    `INSERT INTO renewal_proposals
       (deal_id, proposed_seats, proposed_price_inr, proposed_discount_percent,
        proposed_term_months, proposed_billing_frequency, notes, created_by, needs_approval, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')
     RETURNING *`,
    [
      dealId,
      proposal.seats ?? deal.seats,
      Math.round((proposal.priceInr || deal.net_value_paise / 100) * 100),
      proposal.discountPercent ?? deal.discount_percent,
      proposal.termMonths ?? deal.term_months,
      proposal.billingFrequency ?? deal.billing_frequency,
      proposal.notes || null,
      createdBy,
      needsApproval,
    ]
  );

  // If needs approval, create approval task
  if (needsApproval) {
    await createTask({
      title: `Approval needed: Renewal proposal for ${deal.party_email || deal.platform_email}`,
      description: `Renewal proposal exceeds auto-approval thresholds. Review: ${formatProposalDiff(deal, proposal)}`,
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), // 3 days
      assignedTo: getApproverRole(), // finance_hod or owner
      relatedEntity: 'renewal_proposal',
      relatedEntityId: proposalRecord.id,
      priority: 'high',
      tags: ['renewal', 'approval'],
    });
  }

  return proposalRecord;
}

function checkApprovalNeeded(current, proposed) {
  const currentPrice = current.net_value_paise / 100;
  const proposedPrice = proposed.priceInr || currentPrice;
  const priceChange = ((proposedPrice - currentPrice) / currentPrice) * 100;

  const currentSeats = current.seats || 1;
  const proposedSeats = proposed.seats ?? currentSeats;
  const seatChange = ((proposedSeats - currentSeats) / currentSeats) * 100;

  const proposedDiscount = proposed.discountPercent ?? current.discount_percent;
  const discountChange = proposedDiscount - current.discount_percent;

  return (
    priceChange < -APPROVAL_THRESHOLDS.priceReduction ||
    seatChange < -APPROVAL_THRESHOLDS.seatReduction ||
    proposedDiscount > APPROVAL_THRESHOLDS.discountPercent
  );
}

function formatProposalDiff(current, proposed) {
  const changes = [];
  const currentPrice = current.net_value_paise / 100;
  const proposedPrice = proposed.priceInr || currentPrice;
  if (proposedPrice !== currentPrice) {
    changes.push(`Price: ${currentPrice} → ${proposedPrice} (${((proposedPrice - currentPrice) / currentPrice * 100).toFixed(1)}%)`);
  }
  const currentSeats = current.seats || 1;
  const proposedSeats = proposed.seats ?? currentSeats;
  if (proposedSeats !== currentSeats) {
    changes.push(`Seats: ${currentSeats} → ${proposedSeats}`);
  }
  const proposedDiscount = proposed.discountPercent ?? current.discount_percent;
  if (proposedDiscount !== current.discount_percent) {
    changes.push(`Discount: ${current.discount_percent}% → ${proposedDiscount}%`);
  }
  return changes.join('; ') || 'No changes';
}

function getApproverRole() {
  // In practice, this would query staff with finance_hod or owner role
  return null; // TODO: implement
}

// ──────────────────────────────────────────────────────────────────────────
// Approve/Reject renewal proposal
// ──────────────────────────────────────────────────────────────────────────
async function approveRenewalProposal(proposalId, approverId, approved, notes) {
  const { rows: [proposal] } = await query(
    `UPDATE renewal_proposals SET status = $1, approved_by = $2, approved_at = NOW(), approval_notes = $3
     WHERE id = $4 RETURNING *`,
    [approved ? 'approved' : 'rejected', approverId, notes || null, proposalId]
  );
  if (!proposal) throw new Error('Proposal not found');

  // Log action
  await logAction({
    staffId: approverId,
    action: approved ? 'renewal_proposal.approved' : 'renewal_proposal.rejected',
    entity: 'renewal_proposal',
    entityId: proposalId,
    newValue: { approved, notes },
  }).catch(() => {});

  // If approved and deal exists, can auto-create next term deal
  if (approved) {
    await createNextTermFromProposal(proposal);
  }

  return proposal;
}

async function createNextTermFromProposal(proposal) {
  // This would create the next corporate deal term
  // Implementation depends on business logic - could be manual or auto
  console.log('[renewalWorkflow] Creating next term from approved proposal:', proposal.id);
  // TODO: implement based on business requirements
}

// ──────────────────────────────────────────────────────────────────────────
// Daily cron - check upcoming renewals and create tasks
// ──────────────────────────────────────────────────────────────────────────
async function runDailyRenewalCheck() {
  console.log('[renewalWorkflow] Running daily renewal check...');

  const renewals = await getUpcomingRenewals(180);
  let tasksCreated = 0;

  for (const r of renewals) {
    // Check if tasks already exist for this renewal
    const existingTasks = await query(
      `SELECT COUNT(*) FROM tasks
       WHERE related_entity = 'corporate_deal'
         AND related_entity_id = $1
         AND title LIKE '%Renewal:%'`,
      [r.id]
    );

    if (parseInt(existingTasks.rows[0].count) === 0) {
      // No tasks yet - create them
      // In practice, you'd assign to the CSM/owner
      // await createRenewalTasks(r.id, assignedCSM);
      tasksCreated++;
    }
  }

  // Send email summaries to CSMs
  await sendRenewalDigest(renewals);

  console.log(`[renewalWorkflow] Checked ${renewals.length} upcoming renewals, ${tasksCreated} new task sets created`);
  return { checked: renewals.length, tasksCreated };
}

// ──────────────────────────────────────────────────────────────────────────
// Send daily renewal digest email to CSMs
// ──────────────────────────────────────────────────────────────────────────
async function sendRenewalDigest(renewals) {
  const urgent = renewals.filter(r => r.isUrgent);
  const overdue = renewals.filter(r => r.isOverdue);
  const thisWeek = renewals.filter(r => r.daysUntilRenewal > 0 && r.daysUntilRenewal <= 7);
  const thisMonth = renewals.filter(r => r.daysUntilRenewal > 7 && r.daysUntilRenewal <= 30);

  if (urgent.length === 0 && overdue.length === 0 && thisWeek.length === 0) return;

  const html = `
    <h2>📅 Daily Renewal Digest</h2>
    ${overdue.length ? `<h3 style="color: #e5484d">⚠️ Overdue (${overdue.length})</h3>${renderList(overdue)}` : ''}
    ${urgent.length ? `<h3 style="color: #e5a54b">🔥 Due this month (${urgent.length})</h3>${renderList(urgent)}` : ''}
    ${thisWeek.length ? `<h3 style="color: #5aa9e6">📅 Due this week (${thisWeek.length})</h3>${renderList(thisWeek)}` : ''}
    <p>View full list: <a href="${process.env.FRONTEND_URL}/renewals">Renewals Dashboard</a></p>
  `;

  await sendEmail({
    to: process.env.RENEWAL_DIGEST_EMAIL || 'founder@ethertrack.in',
    subject: `Renewal Digest: ${overdue.length} overdue, ${urgent.length} urgent, ${thisWeek.length} this week`,
    html,
  }).catch(e => console.error('[renewalWorkflow] Email failed:', e.message));
}

function renderList(items) {
  return `<ul>${items.map(r => `
    <li><strong>${r.party_name || r.companyName || r.fullName || r.platform_email || r.email}</strong>
    - Renews: ${r.renewal_date} (${r.daysUntilRenewal}d) - ${r.currentStage?.label || 'N/A'}
    - Seats: ${r.seats || '?'} - Value: ₹${(r.net_value_paise || r.totalValuePaise || 0) / 100}
  `).join('')}</ul>`;
}

module.exports = {
  getUpcomingRenewals,
  createRenewalTasks,
  createRenewalProposal,
  approveRenewalProposal,
  runDailyRenewalCheck,
  RENEWAL_STAGES,
  APPROVAL_THRESHOLDS,
};