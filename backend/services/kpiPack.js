'use strict';
// services/kpiPack.js
//
// Board-Ready KPI Pack - One-click PDF generation
// MRR, NRR, CAC, LTV, Burn, Runway, Headcount efficiency

const { safeQuery: query } = require('../db/pool');
const { fetchPlatformCustomers } = require('./platformClient');
const analytics = require('./analyticsService');

// ──────────────────────────────────────────────────────────────────────────
// Generate complete KPI pack data
// ──────────────────────────────────────────────────────────────────────────
async function generateKPIPackData() {
  const [
    mrr,
    churn,
    expansion,
    unitEcon,
    headcount,
    burn,
    cash,
    pipeline,
  ] = await Promise.all([
    analytics.getMrrSnapshot(),
    analytics.getChurnCohorts(12),
    analytics.getExpansionMetrics(),
    analytics.getUnitEconomics(),
    getHeadcountMetrics(),
    getBurnMetrics(),
    getCashMetrics(),
    getPipelineSummary(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    period: getCurrentPeriod(),
    mrr,
    churn,
    expansion,
    unitEcon,
    headcount,
    burn,
    cash,
    pipeline,
    // Calculated KPIs
    kpis: calculateKPIs(mrr, churn, expansion, unitEcon, headcount, burn, cash),
  };
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Headcount Metrics
// ──────────────────────────────────────────────────────────────────────────
async function getHeadcountMetrics() {
  const { rows } = await query(
    `SELECT 
      COUNT(*) FILTER (WHERE status = 'active') as total_active,
      COUNT(*) FILTER (WHERE status = 'active' AND department = 'Engineering') as engineering,
      COUNT(*) FILTER (WHERE status = 'active' AND department = 'Sales') as sales,
      COUNT(*) FILTER (WHERE status = 'active' AND department = 'Marketing') as marketing,
      COUNT(*) FILTER (WHERE status = 'active' AND department = 'Finance') as finance,
      COUNT(*) FILTER (WHERE status = 'active' AND department = 'HR') as hr,
      COUNT(*) FILTER (WHERE status = 'active' AND department = 'Operations') as operations,
      COUNT(*) FILTER (WHERE status = 'exited' AND exit_date > NOW() - INTERVAL '12 months') as exited_12m,
      COUNT(*) FILTER (WHERE date_of_joining > NOW() - INTERVAL '12 months') as hired_12m
     FROM employees`
  );

  const r = rows[0];
  return {
    totalActive: parseInt(r.total_active),
    byDept: {
      engineering: parseInt(r.engineering),
      sales: parseInt(r.sales),
      marketing: parseInt(r.marketing),
      finance: parseInt(r.finance),
      hr: parseInt(r.hr),
      operations: parseInt(r.operations),
    },
    netHired12m: parseInt(r.hired_12m) - parseInt(r.exited_12m),
    attritionRate: r.total_active ? ((parseInt(r.exited_12m) / parseInt(r.total_active)) * 100).toFixed(1) : 0,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Burn Metrics
// ──────────────────────────────────────────────────────────────────────────
async function getBurnMetrics() {
  const { rows } = await query(
    `SELECT 
      SUM(amount) FILTER (WHERE type = 'expense' AND date > NOW() - INTERVAL '1 month') as monthly_burn,
      SUM(amount) FILTER (WHERE type = 'expense' AND date > NOW() - INTERVAL '3 months') / 3 as avg_monthly_burn_3m,
      SUM(amount) FILTER (WHERE type = 'expense' AND date > NOW() - INTERVAL '6 months') / 6 as avg_monthly_burn_6m,
      SUM(amount) FILTER (WHERE type = 'revenue' AND date > NOW() - INTERVAL '1 month') as monthly_revenue,
      SUM(amount) FILTER (WHERE type = 'revenue' AND date > NOW() - INTERVAL '3 months') / 3 as avg_monthly_revenue_3m
     FROM cash_flow`
  );

  const r = rows[0];
  const monthlyBurn = parseFloat(r.monthly_burn || 0);
  const avgBurn3m = parseFloat(r.avg_monthly_burn_3m || 0);
  const monthlyRevenue = parseFloat(r.monthly_revenue || 0);
  const avgRevenue3m = parseFloat(r.avg_monthly_revenue_3m || 0);

  return {
    monthlyBurn,
    avgMonthlyBurn3m: avgBurn3m,
    monthlyRevenue,
    avgMonthlyRevenue3m: avgRevenue3m,
    netBurn: monthlyBurn - monthlyRevenue,
    netBurn3m: avgBurn3m - avgRevenue3m,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Cash Metrics
// ──────────────────────────────────────────────────────────────────────────
async function getCashMetrics() {
  const { rows } = await query(
    `SELECT 
      SUM(balance) as total_cash,
      SUM(balance) FILTER (WHERE currency = 'INR') as cash_inr,
      SUM(balance) FILTER (WHERE currency = 'USD') as cash_usd
     FROM bank_accounts
     WHERE status = 'active'`
  );

  const r = rows[0];
  return {
    totalCash: parseFloat(r.total_cash || 0),
    cashINR: parseFloat(r.cash_inr || 0),
    cashUSD: parseFloat(r.cash_usd || 0),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Pipeline Summary
// ──────────────────────────────────────────────────────────────────────────
async function getPipelineSummary() {
  const { rows } = await query(
    `SELECT 
      COUNT(*) FILTER (WHERE stage IN ('new', 'qualified', 'proposal_sent', 'negotiation')) as open_deals,
      SUM(deal_value) FILTER (WHERE stage IN ('new', 'qualified', 'proposal_sent', 'negotiation')) as pipeline_value,
      COUNT(*) FILTER (WHERE stage = 'won' AND updated_at > NOW() - INTERVAL '1 month') as won_this_month,
      SUM(deal_value) FILTER (WHERE stage = 'won' AND updated_at > NOW() - INTERVAL '1 month') as revenue_this_month
     FROM deals`
  );

  return rows[0];
}

// ──────────────────────────────────────────────────────────────────────────
// Calculate All KPIs
// ──────────────────────────────────────────────────────────────────────────
function calculateKPIs(mrr, churn, expansion, unitEcon, headcount, burn, cash) {
  const netNewMRR = expansion.netNewMrr || 0;
  const mrrValue = mrr.mrr || 0;
  const arr = mrr.arr || 0;

  // NRR (Net Revenue Retention) - from expansion
  const nrr = mrrValue > 0 
    ? ((mrrValue + netNewMRR) / mrrValue * 100).toFixed(1)
    : 100;

  // GRR (Gross Revenue Retention)
  const grr = mrrValue > 0
    ? ((mrrValue - (expansion.churnedMrr || 0)) / mrrValue * 100).toFixed(1)
    : 100;

  // CAC (Customer Acquisition Cost) - placeholder
  const cac = unitEcon.cac || 0;

  // LTV
  const ltv = unitEcon.ltv || 0;

  // LTV:CAC
  const ltvToCac = cac > 0 ? (ltv / cac).toFixed(1) : 'N/A';

  // Payback Period
  const paybackMonths = unitEcon.paybackMonths || 'N/A';

  // Burn Multiple (Net Burn / Net New ARR)
  const netNewARR = netNewMRR * 12;
  const burnMultiple = netNewARR > 0 ? (burn.netBurn3m * 12 / netNewARR).toFixed(2) : 'N/A';

  // Runway (months)
  const runwayMonths = burn.netBurn3m > 0 
    ? (cash.totalCash / burn.netBurn3m).toFixed(1)
    : 'Infinite';

  // Magic Number (Net New ARR / Sales & Marketing Spend)
  // Would need S&M spend data - placeholder
  const magicNumber = 'N/A';

  // Revenue per Employee
  const revPerEmployee = headcount.totalActive > 0 ? (arr / headcount.totalActive).toFixed(0) : 0;

  // Burn per Employee
  const burnPerEmployee = headcount.totalActive > 0 ? (burn.netBurn3m * 12 / headcount.totalActive).toFixed(0) : 0;

  return {
    // Revenue
    mrr: mrrValue,
    arr,
    netNewMRR,
    nrr: parseFloat(nrr),
    grr: parseFloat(grr),

    // Unit Economics
    ltv,
    cac,
    ltvToCac,
    paybackMonths,
    avgMonthlyChurn: unitEcon.avgMonthlyChurn,

    // Efficiency
    burnMultiple,
    magicNumber,
    revPerEmployee,
    burnPerEmployee,

    // Cash & Burn
    monthlyBurn: burn.monthlyBurn,
    netBurn: burn.netBurn,
    netBurn3m: burn.netBurn3m,
    runwayMonths: parseFloat(runwayMonths),
    totalCash: cash.totalCash,

    // Headcount
    totalHeadcount: headcount.totalActive,
    headcountByDept: headcount.byDept,
    netHired12m: headcount.netHired12m,
    attritionRate: parseFloat(headcount.attritionRate),

    // Pipeline
    openDeals: parseInt(pipeline?.open_deals || 0),
    pipelineValue: parseFloat(pipeline?.pipeline_value || 0),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Generate PDF document definition for pdfmake
// ──────────────────────────────────────────────────────────────────────────
function generatePDFDefinition(data) {
  const { kpis, mrr, churn, expansion, headcount, burn, cash, pipeline, generatedAt, period } = data;

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    header: {
      columns: [
        { text: 'ETPL Ops', style: 'headerTitle' },
        { text: `Board KPI Pack — ${period}`, style: 'headerPeriod', alignment: 'right' },
      ],
      margin: [40, 20, 40, 0],
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'CONFIDENTIAL — Internal Use Only', style: 'footer' },
        { text: `Page ${currentPage} of ${pageCount}`, style: 'footer', alignment: 'right' },
      ],
      margin: [40, 0, 40, 20],
    }),
    content: [
      // Title
      { text: 'Executive KPI Dashboard', style: 'title' },
      { text: `Generated: ${new Date(generatedAt).toLocaleString('en-IN')}`, style: 'subtitle' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2fbf71' }], margin: [0, 10, 0, 20] },

      // Section 1: Revenue KPIs
      { text: '1. REVENUE METRICS', style: 'sectionHeader' },
      createKPITable([
        ['Metric', 'Value', 'Trend/Note'],
        ['Monthly Recurring Revenue (MRR)', formatINR(kpis.mrr), `Net New: ${formatINR(kpis.netNewMRR)}`],
        ['Annual Recurring Revenue (ARR)', formatINR(kpis.arr), ''],
        ['Net Revenue Retention (NRR)', `${kpis.nrr}%`, kpis.nrr >= 100 ? '↑ Healthy' : '↓ At Risk'],
        ['Gross Revenue Retention (GRR)', `${kpis.grr}%`, ''],
        ['Expansion MRR', formatINR(expansion.expansionMrr || 0), ''],
        ['Churned MRR', formatINR(expansion.churnedMrr || 0), ''],
      ]),

      // Section 2: Unit Economics
      { text: '2. UNIT ECONOMICS', style: 'sectionHeader', margin: [0, 20, 0, 10] },
      createKPITable([
        ['Metric', 'Value', 'Benchmark'],
        ['Customer Lifetime Value (LTV)', formatINR(kpis.ltv), '> 3x CAC'],
        ['Customer Acquisition Cost (CAC)', formatINR(kpis.cac), '< LTV/3'],
        ['LTV:CAC Ratio', kpis.ltvToCac, '> 3.0'],
        ['Payback Period', `${kpis.paybackMonths} months`, '< 12 months'],
        ['Avg Monthly Churn', `${kpis.avgMonthlyChurn}%`, '< 3%'],
      ]),

      // Section 3: Efficiency & Cash
      { text: '3. EFFICIENCY & CASH', style: 'sectionHeader', margin: [0, 20, 0, 10] },
      createKPITable([
        ['Metric', 'Value', 'Note'],
        ['Monthly Burn', formatINR(kpis.monthlyBurn), `Net: ${formatINR(kpis.netBurn)}`],
        ['Net Burn (3m avg)', formatINR(kpis.netBurn3m), ''],
        ['Runway', `${kpis.runwayMonths} months`, kpis.runwayMonths > 12 ? '✅ Healthy' : '⚠️ Monitor'],
        ['Total Cash', formatINR(kpis.totalCash), `INR: ${formatINR(kpis.totalCash)}`],
        ['Burn Multiple', kpis.burnMultiple, '< 1.5x ideal'],
        ['Magic Number', kpis.magicNumber, '> 1.0 ideal'],
      ]),

      // Section 4: Headcount & Productivity
      { text: '4. HEADCOUNT & PRODUCTIVITY', style: 'sectionHeader', margin: [0, 20, 0, 10] },
      createKPITable([
        ['Metric', 'Value', 'Detail'],
        ['Total Headcount', kpis.totalHeadcount, `Net +${kpis.netHired12m} (12m)`],
        ['Engineering', kpis.headcountByDept?.engineering || 0, ''],
        ['Sales', kpis.headcountByDept?.sales || 0, ''],
        ['Marketing', kpis.headcountByDept?.marketing || 0, ''],
        ['Finance', kpis.headcountByDept?.finance || 0, ''],
        ['HR', kpis.headcountByDept?.hr || 0, ''],
        ['Operations', kpis.headcountByDept?.operations || 0, ''],
        ['Attrition (12m)', `${kpis.attritionRate}%`, '< 15% ideal'],
        ['Revenue/Employee', formatINR(kpis.revPerEmployee), ''],
        ['Burn/Employee', formatINR(kpis.burnPerEmployee), ''],
      ]),

      // Section 5: Pipeline
      { text: '5. SALES PIPELINE', style: 'sectionHeader', margin: [0, 20, 0, 10] },
      createKPITable([
        ['Metric', 'Value'],
        ['Open Deals', kpis.openDeals],
        ['Pipeline Value', formatINR(kpis.pipelineValue)],
        ['Won This Month', pipeline.won_this_month || 0],
        ['Revenue This Month', formatINR(pipeline.revenue_this_month || 0)],
      ]),

      // Section 6: Churn Cohorts Summary
      { text: '6. CHURN COHORTS (Latest 6 Months)', style: 'sectionHeader', margin: [0, 20, 0, 10] },
      createChurnTable(churn.slice(-6)),

      // Section 6: Action Items
      { text: '7. KEY ACTION ITEMS', style: 'sectionHeader', margin: [0, 20, 0, 10] },
      { ul: generateActionItems(kpis), style: 'actionItem' },
    ],
    styles: {
      title: { fontSize: 22, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 5] },
      subtitle: { fontSize: 10, color: '#666', margin: [0, 0, 0, 15] },
      sectionHeader: { fontSize: 13, bold: true, color: '#1e3a5f', margin: [0, 15, 0, 5] },
      tableHeader: { bold: true, fontSize: 9, fillColor: '#1e3a5f', color: 'white', alignment: 'center' },
      tableCell: { fontSize: 9, margin: [2, 2, 2, 2] },
      actionItem: { fontSize: 9, margin: [20, 2, 0, 2] },
      headerTitle: { fontSize: 10, bold: true, color: '#1e3a5f' },
      headerPeriod: { fontSize: 9, color: '#666' },
      footer: { fontSize: 7, color: '#999' },
    },
    defaultStyle: { font: 'Helvetica' },
  };
}

function createKPITable(rows) {
  return {
    table: {
      headerRows: 1,
      widths: ['45%', '35%', '20%'],
      body: rows.map((row, i) => row.map((cell, j) => ({
        text: cell,
        style: i === 0 ? 'tableHeader' : 'tableCell',
        alignment: j === 1 ? 'right' : j === 2 ? 'center' : 'left',
      }))),
    },
    layout: {
      hLineWidth: (i) => i === 0 || i === rows.length ? 1 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#ddd',
      vLineColor: () => '#ddd',
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

function createChurnTable(churn) {
  const rows = [
    ['Cohort', 'Started', 'Active', 'Retention %', 'NRR %'],
    ...churn.map(c => [c.cohortMonth, c.started, c.active, `${c.retentionRate}%`, `${c.netRevenueRetention}%`]),
  ];
  return createKPITable(rows);
}

function generateActionItems(kpis) {
  const items = [];
  if (kpis.nrr < 100) items.push(`NRR at ${kpis.nrr}% — Prioritize expansion & reduce churn`);
  if (kpis.runwayMonths < 12) items.push(`Runway only ${kpis.runwayMonths} months — Extend runway or raise capital`);
  if (kpis.avgMonthlyChurn > 3) items.push(`Monthly churn ${kpis.avgMonthlyChurn}% — Launch retention program`);
  if (kpis.ltvToCac && kpis.ltvToCac < 3) items.push(`LTV:CAC ${kpis.ltvToCac}x — Optimize acquisition or increase LTV`);
  if (kpis.attritionRate > 15) items.push(`Attrition ${kpis.attritionRate}% — Review compensation & culture`);
  if (items.length === 0) items.push('All metrics healthy — Continue execution');
  return items;
}

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

module.exports = {
  generateKPIPackData,
  generatePDFDefinition,
  formatINR,
};