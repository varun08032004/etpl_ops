'use strict';
// services/vendorIntelligence.js
//
// Vendor Spend Intelligence
// Consolidate duplicate SaaS, track renewals, benchmark pricing, negotiation insights

const { safeQuery: query } = require('../db/pool');
const { createTask } = require('./tasks');
const { sendEmail } = require('./email');
const { logAction } = require('./auditLog');

// ──────────────────────────────────────────────────────────────────────────
// Vendor Normalization & Deduplication
// ──────────────────────────────────────────────────────────────────────────

// Common vendor name variations for fuzzy matching
const VENDOR_ALIASES = {
  'amazon web services': ['aws', 'amazon aws', 'amazon web services inc', 'aws inc'],
  'google cloud': ['gcp', 'google cloud platform', 'google llc'],
  'microsoft azure': ['azure', 'microsoft azure inc', 'msft azure'],
  'slack': ['slack technologies', 'slack technologies inc'],
  'atlassian': ['atlassian pty ltd', 'atlassian inc', 'jira', 'confluence'],
  'github': ['github inc', 'microsoft github'],
  'gitlab': ['gitlab inc', 'gitlab bv'],
  'zoom': ['zoom video communications', 'zoom video communications inc'],
  'notion': ['notion labs inc', 'notion labs'],
  'figma': ['figma inc', 'figma inc.'],
  'datadog': ['datadog inc', 'datadog'],
  'new relic': ['new relic inc', 'new relic'],
  'snowflake': ['snowflake inc', 'snowflake computing'],
  'stripe': ['stripe inc', 'stripe payments'],
  'twilio': ['twilio inc', 'twilio'],
  'sendgrid': ['sendgrid inc', 'twilio sendgrid'],
  'mailchimp': ['mailchimp', 'the rocket science group'],
  'hubspot': ['hubspot inc', 'hubspot'],
  'salesforce': ['salesforce inc', 'salesforce.com'],
  'servicenow': ['servicenow inc', 'servicenow'],
  'workday': ['workday inc', 'workday'],
  'adobe': ['adobe inc', 'adobe systems'],
  'okta': ['okta inc', 'okta identity'],
  'auth0': ['auth0 inc', 'okta auth0'],
  'mongoDB': ['mongodb inc', 'mongodb'],
  'redis': ['redis labs', 'redis inc'],
  'elastic': ['elastic nv', 'elastic search'],
  'confluent': ['confluent inc', 'confluent cloud'],
  'hashicorp': ['hashicorp inc', 'terraform cloud'],
  'vercel': ['vercel inc', 'zeit inc'],
  'netlify': ['netlify inc', 'netlify'],
  'cloudflare': ['cloudflare inc', 'cloudflare'],
  'fastly': ['fastly inc', 'fastly'],
  'heroku': ['heroku inc', 'salesforce heroku'],
  'digitalocean': ['digitalocean inc', 'digitalocean'],
  'linode': ['linode llc', 'akamai linode'],
  'vultr': ['vultr holdings', 'vultr'],
  'pagerduty': ['pagerduty inc', 'pagerduty'],
  'opsgenie': ['opsgenie inc', 'atlassian opsgenie'],
  'victorops': ['victorops inc', 'splunk victorops'],
  'splunk': ['splunk inc', 'splunk'],
  'sumo logic': ['sumo logic inc', 'sumo logic'],
  'loggly': ['loggly inc', 'solarwinds loggly'],
  'papertrail': ['papertrail inc', 'solarwinds papertrail'],
};

function normalizeVendorName(name) {
  if (!name) return '';
  const normalized = name.toLowerCase().trim()
    .replace(/[.,']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(inc|llc|ltd|pvt|pvt\.|ltd\.|corp|corporation|technologies|technology|systems|solutions|services|platform|inc\.|llc\.|ltd\.)\b/g, '');

  // Check aliases
  for (const [canonical, aliases] of Object.entries(VENDOR_ALIASES)) {
    if (normalized === canonical || aliases.includes(normalized)) {
      return canonical;
    }
    // Partial match for common variations
    for (const alias of aliases) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return canonical;
      }
    }
  }

  return normalized;
}

// ──────────────────────────────────────────────────────────────────────────
// Get all vendors with spend analysis
// ──────────────────────────────────────────────────────────────────────────
async function getVendorSpendAnalysis(months = 12) {
  const { rows } = await query(
    `SELECT 
      p.id as vendor_id,
      p.name as vendor_name,
      p.gstin,
      p.email,
      p.phone,
      COUNT(DISTINCT i.id) as invoice_count,
      SUM(i.amount) as total_spend,
      AVG(i.amount) as avg_invoice_amount,
      MIN(i.invoice_date) as first_invoice_date,
      MAX(i.invoice_date) as last_invoice_date,
      COUNT(DISTINCT DATE_TRUNC('month', i.invoice_date)) as active_months,
      SUM(CASE WHEN i.gst_rate > 0 THEN (i.amount * i.gst_rate / 100) ELSE 0 END) as total_gst
     FROM invoices i
     JOIN parties p ON p.id = i.party_id
     WHERE i.invoice_date > NOW() - INTERVAL '${months} months'
       AND i.status NOT IN ('cancelled', 'draft')
       AND i.amount > 0
     GROUP BY p.id, p.name, p.gstin, p.email, p.phone
     ORDER BY total_spend DESC`,
  );

  // Normalize vendor names and consolidate
  const vendorMap = new Map();
  for (const row of rows) {
    const canonical = normalizeVendorName(row.vendor_name);
    if (!vendorMap.has(canonical)) {
      vendorMap.set(canonical, {
        canonical_name: canonical,
        original_names: [row.vendor_name],
        vendor_ids: [row.vendor_id],
        gstin: row.gstin,
        email: row.email,
        phone: row.phone,
        invoice_count: 0,
        total_spend: 0,
        avg_invoice_amount: 0,
        first_invoice_date: row.first_invoice_date,
        last_invoice_date: row.last_invoice_date,
        active_months: 0,
        total_gst: 0,
        category: categorizeVendor(canonical),
      });
    }

    const v = vendorMap.get(canonical);
    v.original_names.push(row.vendor_name);
    v.vendor_ids.push(row.vendor_id);
    v.invoice_count += row.invoice_count;
    v.total_spend += parseFloat(row.total_spend);
    v.avg_invoice_amount = (v.avg_invoice_amount * (v.invoice_count - row.invoice_count) + parseFloat(row.avg_invoice_amount) * row.invoice_count) / v.invoice_count;
    v.active_months = Math.max(v.active_months, row.active_months);
    v.total_gst += parseFloat(row.total_gst);
    if (new Date(row.first_invoice_date) < new Date(v.first_invoice_date)) v.first_invoice_date = row.first_invoice_date;
    if (new Date(row.last_invoice_date) > new Date(v.last_invoice_date)) v.last_invoice_date = row.last_invoice_date;
  }

  // Convert to array and sort
  return Array.from(vendorMap.values())
    .sort((a, b) => b.total_spend - a.total_spend);
}

function categorizeVendor(name) {
  const categories = {
    'cloud_infrastructure': ['amazon web services', 'google cloud', 'microsoft azure', 'digitalocean', 'linode', 'vultr', 'heroku', 'vercel', 'netlify'],
    'saas_productivity': ['slack', 'notion', 'figma', 'zoom', 'atlassian', 'github', 'gitlab', 'confluent', 'hashicorp', 'okta', 'auth0'],
    'monitoring_observability': ['datadog', 'new relic', 'pagerduty', 'opsgenie', 'victorops', 'splunk', 'sumo logic', 'loggly', 'papertrail', 'elastic', 'grafana'],
    'data_analytics': ['snowflake', 'mongoDB', 'redis', 'confluent', 'databricks'],
    'payments_finance': ['stripe', 'twilio', 'sendgrid', 'mailchimp'],
    'crm_sales': ['hubspot', 'salesforce', 'pipedrive', 'close'],
    'hr_operations': ['workday', 'bamboohr', 'gusto', 'rippling', 'deput', 'deputy'],
    'design_creative': ['adobe', 'figma', 'canva', 'miro'],
    'communication': ['slack', 'zoom', 'teams', 'discord'],
  };

  for (const [category, vendors] of Object.entries(categories)) {
    if (vendors.includes(name)) return category;
  }
  return 'other';
}

// ──────────────────────────────────────────────────────────────────────────
// Detect Duplicate/Similar Vendors
// ──────────────────────────────────────────────────────────────────────────
async function detectDuplicateVendors() {
  const vendors = await getVendorSpendAnalysis(24);
  const duplicates = [];

  for (let i = 0; i < vendors.length; i++) {
    for (let j = i + 1; j < vendors.length; j++) {
      const v1 = vendors[i];
      const v2 = vendors[j];

      // Skip if already consolidated
      if (v1.vendor_ids.some(id => v2.vendor_ids.includes(id))) continue;

      // Check similarity
      const similarity = calculateSimilarity(v1.canonical_name, v2.canonical_name);
      if (similarity > 0.8) {
        duplicates.push({
          vendor1: v1,
          vendor2: v2,
          similarity: Math.round(similarity * 100),
          combined_spend: v1.total_spend + v2.total_spend,
          recommendation: `Consolidate ${v2.canonical_name} into ${v1.canonical_name} (save admin overhead)`,
        });
      }
    }
  }

  return duplicates.sort((a, b) => b.similarity - a.similarity);
}

function calculateSimilarity(str1, str2) {
  // Simple Jaccard similarity on bigrams
  const bigrams1 = new Set();
  for (let i = 0; i < str1.length - 1; i++) bigrams1.add(str1.slice(i, i + 2));
  const bigrams2 = new Set();
  for (let i = 0; i < str2.length - 1; i++) bigrams2.add(str2.slice(i, i + 2));

  let intersection = 0;
  for (const bg of bigrams1) if (bigrams2.has(bg)) intersection++;
  const union = bigrams1.size + bigrams2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Renewal Tracking & Negotiation Insights
// ──────────────────────────────────────────────────────────────────────────
async function getRenewalCalendar(monthsAhead = 6) {
  // For SaaS vendors, we track based on invoice frequency and last invoice date
  const vendors = await getVendorSpendAnalysis(24);

  const renewals = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + monthsAhead * 30 * 86400000);

  for (const v of vendors) {
    if (!v.last_invoice_date) continue;

    const lastInvoice = new Date(v.last_invoice_date);
    const monthsSinceLast = (now - lastInvoice) / (30 * 86400000);
    const avgCycle = v.active_months > 0 ? 12 / (v.active_months / (24 / 12)) : 12; // estimated annual cycle

    // Estimate next renewal based on frequency
    let nextRenewal = new Date(lastInvoice);
    nextRenewal.setMonth(nextRenewal.getMonth() + Math.round(monthsSinceLast / v.active_months * 12) + 1);

    // If renewal is within window
    if (nextRenewal <= cutoff) {
      renewals.push({
        vendor: v.canonical_name,
        original_names: v.original_names,
        category: v.category,
        last_invoice_date: v.last_invoice_date,
        estimated_renewal: nextRenewal.toISOString().slice(0, 10),
        days_until_renewal: Math.ceil((nextRenewal - now) / 86400000),
        annual_spend: v.total_spend * (12 / 24), // normalized to annual
        invoice_count: v.invoice_count,
        avg_invoice: v.avg_invoice_amount,
        negotiation_leverage: calculateLeverage(v),
        suggested_action: getRenewalAction(v, monthsSinceLast),
      });
    }
  }

  return renewals.sort((a, b) => a.days_until_renewal - b.days_until_renewal);
}

function calculateLeverage(vendor) {
  let score = 0;
  const factors = [];

  if (vendor.total_spend > 1000000) { score += 30; factors.push('High spend (>₹10L)'); }
  else if (vendor.total_spend > 500000) { score += 20; factors.push('Medium spend (>₹5L)'); }
  else if (vendor.total_spend > 100000) { score += 10; factors.push('Moderate spend (>₹1L)'); }

  if (vendor.invoice_count > 12) { score += 20; factors.push('High frequency'); }
  else if (vendor.invoice_count > 6) { score += 10; factors.push('Regular frequency'); }

  if (vendor.active_months > 18) { score += 15; factors.push('Long relationship'); }
  else if (vendor.active_months > 12) { score += 10; factors.push('Established'); }

  // Category leverage
  const highLeverageCats = ['cloud_infrastructure', 'monitoring_observability', 'data_analytics'];
  if (highLeverageCats.includes(vendor.category)) { score += 15; factors.push('High-leverage category'); }

  return {
    score: Math.min(score, 100),
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    factors,
  };
}

function getRenewalAction(vendor, monthsSinceLast) {
  if (monthsSinceLast > 24) return 'URGENT: Vendor may have been cancelled - verify status';
  if (monthsSinceLast > 18) return 'Contact vendor - renewal likely overdue';
  if (monthsSinceLast > 12) return 'Start negotiation 60 days before renewal';
  if (monthsSinceLast > 6) return 'Review usage & prepare renewal terms';
  return 'Monitor - renewal not yet due';
}

// ──────────────────────────────────────────────────────────────────────────
// Benchmark Pricing (Anonymous Industry Data)
// ──────────────────────────────────────────────────────────────────────────
const INDUSTRY_BENCHMARKS = {
  'cloud_infrastructure': { p50: 500000, p75: 2000000, unit: 'per_month' },
  'saas_productivity': { p50: 50000, p75: 200000, unit: 'per_month_per_user' },
  'monitoring_observability': { p50: 100000, p75: 500000, unit: 'per_month' },
  'data_analytics': { p50: 200000, p75: 1000000, unit: 'per_month' },
  'crm_sales': { p50: 50000, p75: 200000, unit: 'per_month_per_user' },
  'design_creative': { p50: 20000, p75: 100000, unit: 'per_month_per_user' },
};

function getBenchmark(category) {
  return INDUSTRY_BENCHMARKS[category] || { p50: 100000, p75: 500000 };
}

async function getBenchmarkComparison() {
  const vendors = await getVendorSpendAnalysis(12);
  const comparisons = [];

  for (const v of vendors) {
    const benchmark = getBenchmark(v.category);
    const monthlySpend = v.total_spend / 12;

    if (monthlySpend > 0) {
      const vsP50 = ((monthlySpend - benchmark.p50) / benchmark.p50 * 100).toFixed(1);
      const vsP75 = ((monthlySpend - benchmark.p75) / benchmark.p75 * 100).toFixed(1);

      comparisons.push({
        vendor: v.canonical_name,
        category: v.category,
        monthly_spend: monthlySpend,
        benchmark_p50: benchmark.p50,
        benchmark_p75: benchmark.p75,
        vs_p50_pct: parseFloat(vsP50),
        vs_p75_pct: parseFloat(vsP75),
        status: monthlySpend > benchmark.p75 ? 'above_market' : monthlySpend > benchmark.p50 ? 'at_market' : 'below_market',
        savings_opportunity: monthlySpend > benchmark.p50 ? monthlySpend - benchmark.p50 : 0,
      });
    }
  }

  return comparisons.sort((a, b) => b.savings_opportunity - a.savings_opportunity);
}

// ──────────────────────────────────────────────────────────────────────────
// Negotiation Preparation
// ──────────────────────────────────────────────────────────────────────────
async function prepareNegotiationPack(vendorName) {
  const vendors = await getVendorSpendAnalysis(24);
  const vendor = vendors.find(v => v.canonical_name === vendorName);
  if (!vendor) throw new Error('Vendor not found');

  const leverage = calculateLeverage(vendor);
  const benchmark = getBenchmark(vendor.category);
  const monthlySpend = vendor.total_spend / 12;

  return {
    vendor: vendor.canonical_name,
    category: vendor.category,
    total_spend_24m: vendor.total_spend,
    monthly_spend: monthlySpend,
    invoice_count: vendor.invoice_count,
    avg_invoice: vendor.avg_invoice_amount,
    first_invoice: vendor.first_invoice_date,
    last_invoice: vendor.last_invoice_date,
    leverage,
    benchmark,
    current_vs_benchmark: {
      p50_diff_pct: ((monthlySpend - benchmark.p50) / benchmark.p50 * 100).toFixed(1),
      p75_diff_pct: ((monthlySpend - benchmark.p75) / benchmark.p75 * 100).toFixed(1),
    },
    negotiation_points: generateNegotiationPoints(vendor, leverage, benchmark),
    recommended_ask: generateRecommendedAsk(vendor, leverage, benchmark),
  };
}

function generateNegotiationPoints(vendor, leverage, benchmark) {
  const points = [];
  const monthlySpend = vendor.total_spend / 12;

  if (leverage.level === 'high') {
    points.push('Leverage: High spend + long relationship = strong position');
  }

  if (monthlySpend > benchmark.p75) {
    points.push(`Paying ${((monthlySpend / benchmark.p75 - 1) * 100).toFixed(0)}% above market 75th percentile - demand volume discount`);
  } else if (monthlySpend > benchmark.p50) {
    points.push(`Paying ${((monthlySpend / benchmark.p50 - 1) * 100).toFixed(0)}% above market median - request rate alignment`);
  }

  if (vendor.invoice_count > 12) {
    points.push(`${vendor.invoice_count} invoices/year = predictable revenue for vendor, ask for annual prepay discount`);
  }

  if (vendor.active_months > 24) {
    points.push(`${Math.round(vendor.active_months/12)} year relationship - loyalty deserves better terms`);
  }

  points.push('Request: 10-20% discount for annual prepay + price lock for 2-3 years');
  points.push('Request: Co-term all contracts to single renewal date');
  points.push('Request: SLA improvements (uptime, support response) at no extra cost');

  return points;
}

function generateRecommendedAsk(vendor, leverage, benchmark) {
  const monthlySpend = vendor.total_spend / 12;
  let targetDiscount = 0;

  if (leverage.level === 'high') targetDiscount = 20;
  else if (leverage.level === 'medium') targetDiscount = 15;
  else targetDiscount = 10;

  if (monthlySpend > benchmark.p75) targetDiscount += 5;
  if (vendor.invoice_count > 12) targetDiscount += 5;

  return {
    discount_pct: Math.min(targetDiscount, 25),
    terms: 'Annual prepayment, 2-year price lock, co-termed renewal',
    estimated_annual_savings: Math.round(monthlySpend * 12 * targetDiscount / 100),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Savings Opportunities Summary
// ──────────────────────────────────────────────────────────────────────────
async function getSavingsOpportunities() {
  const comparisons = await getBenchmarkComparison();
  const duplicates = await detectDuplicateVendors();
  const renewals = await getRenewalCalendar(3);

  const totalSavings = comparisons
    .filter(c => c.savings_opportunity > 0)
    .reduce((sum, c) => sum + c.savings_opportunity, 0);

  const duplicateSavings = duplicates
    .reduce((sum, d) => sum + Math.min(d.vendor1.total_spend, d.vendor2.total_spend) * 0.1, 0); // 10% admin savings

  const renewalRisk = renewals
    .filter(r => r.days_until_renewal <= 30)
    .reduce((sum, r) => sum + r.annual_spend * 0.15, 0); // 15% risk of overpaying

  return {
    total_potential_annual_savings: totalSavings + duplicateSavings + renewalRisk,
    benchmark_savings: totalSavings,
    consolidation_savings: duplicateSavings,
    renewal_risk_mitigation: renewalRisk,
    top_opportunities: comparisons
      .filter(c => c.savings_opportunity > 0)
      .slice(0, 10)
      .map(c => ({
        vendor: c.vendor,
        category: c.category,
        current_spend: c.monthly_spend,
        benchmark_p50: c.benchmark_p50,
        potential_savings: c.savings_opportunity,
        action: 'Negotiate to market rate',
      })),
    duplicate_vendors: duplicates.slice(0, 5).map(d => ({
      vendor1: d.vendor1.canonical_name,
      vendor2: d.vendor2.canonical_name,
      combined_spend: d.combined_spend,
      similarity: d.similarity,
    })),
    upcoming_renewals: renewals
      .filter(r => r.days_until_renewal <= 60)
      .slice(0, 10)
      .map(r => ({
        vendor: r.vendor,
        days_left: r.days_until_renewal,
        annual_spend: r.annual_spend,
        leverage: r.negotiation_leverage.level,
        suggested_action: r.suggested_action,
      })),
  };
}

module.exports = {
  getVendorSpendAnalysis,
  detectDuplicateVendors,
  getRenewalCalendar,
  getBenchmarkComparison,
  prepareNegotiationPack,
  getSavingsOpportunities,
  normalizeVendorName,
  categorizeVendor,
  INDUSTRY_BENCHMARKS,
};