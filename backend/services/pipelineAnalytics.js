'use strict';
// services/pipelineAnalytics.js
//
// Deal Velocity & Pipeline Analytics
// Time-to-close by stage/rep/source, conversion rates, forecasting

const { safeQuery: query } = require('../db/pool');
const { logAction } = require('./auditLog');

// ──────────────────────────────────────────────────────────────────────────
// Deal Velocity - Average time in each stage
// ──────────────────────────────────────────────────────────────────────────
async function getDealVelocity(filters = {}) {
  let sql = `
    SELECT 
      ds.stage,
      COUNT(*) as deal_count,
      AVG(ds.duration_days) as avg_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ds.duration_days) as median_days,
      MIN(ds.duration_days) as min_days,
      MAX(ds.duration_days) as max_days,
      SUM(d.deal_value) as total_value
    FROM deal_stages ds
    JOIN deals d ON d.id = ds.deal_id
    WHERE ds.ended_at IS NOT NULL
  `;
  const params = [];
  let paramIdx = 1;

  if (filters.repId) {
    params.push(filters.repId);
    sql += ` AND d.owner_id = $${paramIdx++}`;
  }
  if (filters.source) {
    params.push(filters.source);
    sql += ` AND d.source = $${paramIdx++}`;
  }
  if (filters.fromDate) {
    params.push(filters.fromDate);
    sql += ` AND ds.started_at >= $${paramIdx++}`;
  }
  if (filters.toDate) {
    params.push(filters.toDate);
    sql += ` AND ds.started_at <= $${paramIdx++}`;
  }

  sql += ` GROUP BY ds.stage ORDER BY ds.stage`;

  const { rows } = await query(sql, params);
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Conversion Rates by Stage
// ──────────────────────────────────────────────────────────────────────────
async function getConversionRates(filters = {}) {
  const { rows: deals } = await query(
    `SELECT d.*, 
      ds.stage as final_stage,
      ds.started_at as stage_started,
      ds.ended_at as stage_ended
     FROM deals d
     LEFT JOIN deal_stages ds ON ds.deal_id = d.id
     WHERE d.created_at > NOW() - INTERVAL '12 months'
     ORDER BY d.created_at`
  );

  // Calculate funnel conversion
  const stages = ['new', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'];
  const funnel = {};

  for (const stage of stages) {
    const count = deals.filter(d => {
      if (stage === 'new') return true;
      return d.final_stage === stage || stages.indexOf(d.final_stage) > stages.indexOf(stage);
    }).length;
    funnel[stage] = count;
  }

  const conversionRates = {};
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    conversionRates[`${from}_to_${to}`] = funnel[from] > 0 
      ? ((funnel[to] / funnel[from]) * 100).toFixed(1)
      : 0;
  }

  return { funnel, conversionRates };
}

// ──────────────────────────────────────────────────────────────────────────
// Rep Performance - Time to close, win rate, avg deal size
// ──────────────────────────────────────────────────────────────────────────
async function getRepPerformance(filters = {}) {
  let sql = `
    SELECT 
      u.id as rep_id,
      u.full_name as rep_name,
      COUNT(d.id) as total_deals,
      COUNT(d.id) FILTER (WHERE d.stage = 'won') as won_deals,
      COUNT(d.id) FILTER (WHERE d.stage = 'lost') as lost_deals,
      AVG(d.deal_value) FILTER (WHERE d.stage = 'won') as avg_deal_size,
      SUM(d.deal_value) FILTER (WHERE d.stage = 'won') as total_revenue,
      AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at))/86400) FILTER (WHERE d.stage = 'won') as avg_days_to_close,
      COUNT(d.id) FILTER (WHERE d.source = 'inbound') as inbound_deals,
      COUNT(d.id) FILTER (WHERE d.source = 'outbound') as outbound_deals,
      COUNT(d.id) FILTER (WHERE d.source = 'referral') as referral_deals
    FROM deals d
    JOIN staff_accounts u ON u.id = d.owner_id
    WHERE d.created_at > NOW() - INTERVAL '12 months'
  `;
  const params = [];

  if (filters.fromDate) {
    params.push(filters.fromDate);
    sql += ` AND d.created_at >= $${params.length}`;
  }
  if (filters.toDate) {
    params.push(filters.toDate);
    sql += ` AND d.created_at <= $${params.length}`;
  }

  sql += ` GROUP BY u.id, u.full_name ORDER BY total_revenue DESC NULLS LAST`;

  const { rows } = await query(sql, params);
  return rows.map(r => ({
    ...r,
    winRate: r.total_deals > 0 ? ((r.won_deals / r.total_deals) * 100).toFixed(1) : 0,
    lossRate: r.total_deals > 0 ? ((r.lost_deals / r.total_deals) * 100).toFixed(1) : 0,
  }));
}

// ──────────────────────────────────────────────────────────────────────────
// Source Performance - Conversion by lead source
// ──────────────────────────────────────────────────────────────────────────
async function getSourcePerformance() {
  const { rows } = await query(
    `SELECT 
      d.source,
      COUNT(*) as total_deals,
      COUNT(*) FILTER (WHERE d.stage = 'won') as won,
      COUNT(*) FILTER (WHERE d.stage = 'lost') as lost,
      AVG(d.deal_value) FILTER (WHERE d.stage = 'won') as avg_deal_size,
      SUM(d.deal_value) FILTER (WHERE d.stage = 'won') as total_revenue,
      AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at))/86400) FILTER (WHERE d.stage = 'won') as avg_days_to_close
    FROM deals d
    WHERE d.created_at > NOW() - INTERVAL '12 months'
    GROUP BY d.source
    ORDER BY total_revenue DESC NULLS LAST`
  );

  return rows.map(r => ({
    ...r,
    winRate: r.total_deals > 0 ? ((r.won / r.total_deals) * 100).toFixed(1) : 0,
  }));
}

// ──────────────────────────────────────────────────────────────────────────
// Pipeline Forecast - Weighted pipeline value
// ──────────────────────────────────────────────────────────────────────────
async function getPipelineForecast() {
  const STAGE_PROBABILITY = {
    new: 0.10,
    qualified: 0.25,
    proposal_sent: 0.50,
    negotiation: 0.75,
    won: 1.0,
    lost: 0.0,
  };

  const { rows: deals } = await query(
    `SELECT d.*, u.full_name as owner_name
     FROM deals d
     JOIN staff_accounts u ON u.id = d.owner_id
     WHERE d.stage IN ('new', 'qualified', 'proposal_sent', 'negotiation')
     ORDER BY d.deal_value DESC`
  );

  const forecast = deals.map(d => ({
    ...d,
    probability: STAGE_PROBABILITY[d.stage] || 0,
    weightedValue: d.deal_value * (STAGE_PROBABILITY[d.stage] || 0),
    daysInStage: d.stage_changed_at ? Math.floor((Date.now() - new Date(d.stage_changed_at).getTime()) / 86400000) : 0,
  }));

  const summary = {
    totalPipeline: forecast.reduce((sum, d) => sum + d.deal_value, 0),
    weightedPipeline: forecast.reduce((sum, d) => sum + d.weightedValue, 0),
    byStage: {},
    byRep: {},
    bySource: {},
    atRisk: forecast.filter(d => d.daysInStage > 30).length,
  };

  for (const d of forecast) {
    summary.byStage[d.stage] = (summary.byStage[d.stage] || 0) + d.deal_value;
    summary.byRep[d.owner_name] = (summary.byRep[d.owner_name] || 0) + d.weightedValue;
    summary.bySource[d.source] = (summary.bySource[d.source] || 0) + d.weightedValue;
  }

  return { deals: forecast, summary };
}

// ──────────────────────────────────────────────────────────────────────────
// Stalled Deals - Deals stuck in stage too long
// ──────────────────────────────────────────────────────────────────────────
async function getStalledDeals(thresholdDays = 30) {
  const { rows } = await query(
    `SELECT d.*, u.full_name as owner_name,
      EXTRACT(EPOCH FROM (NOW() - d.stage_changed_at))/86400 as days_in_stage
     FROM deals d
     JOIN staff_accounts u ON u.id = d.owner_id
     WHERE d.stage IN ('new', 'qualified', 'proposal_sent', 'negotiation')
       AND d.stage_changed_at < NOW() - ($1 || ' days')::interval
     ORDER BY days_in_stage DESC`,
    [thresholdDays]
  );
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Win/Loss Analysis
// ──────────────────────────────────────────────────────────────────────────
async function getWinLossAnalysis() {
  const { rows: won } = await query(
    `SELECT lost_reason, COUNT(*) as count
     FROM deals
     WHERE stage = 'lost' AND lost_reason IS NOT NULL
       AND updated_at > NOW() - INTERVAL '12 months'
     GROUP BY lost_reason
     ORDER BY count DESC`
  );

  const { rows: lost } = await query(
    `SELECT d.lost_reason, COUNT(*) as count, AVG(d.deal_value) as avg_value
     FROM deals d
     WHERE d.stage = 'lost' AND d.lost_reason IS NOT NULL
       AND d.updated_at > NOW() - INTERVAL '12 months'
     GROUP BY d.lost_reason
     ORDER BY count DESC`
  );

  return { winReasons: won, lossReasons: lost };
}

module.exports = {
  getDealVelocity,
  getConversionRates,
  getRepPerformance,
  getSourcePerformance,
  getPipelineForecast,
  getStalledDeals,
  getWinLossAnalysis,
};