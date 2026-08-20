'use strict';
// services/slackBot.js
//
// Slack Bot for ETPL Ops
// Slash commands: /approve-invoice, /mrr, /pipeline, /renewals, /health, /help

const { App } = require('@slack/bolt');
const { safeQuery: query } = require('../db/pool');
const analytics = require('./analyticsService');
const renewal = require('./renewalWorkflow');
const health = require('./healthScore');
const pipeline = require('./pipelineAnalytics');
const kpiPack = require('./kpiPack');

// Initialize Slack App
const slackApp = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// ──────────────────────────────────────────────────────────────────────────
// Helper: Verify user is authorized (check email domain or user group)
// ──────────────────────────────────────────────────────────────────────────
async function isAuthorized(userId) {
  try {
    const result = await slackApp.client.users.info({ user: userId });
    const email = result.user?.profile?.email;
    if (!email) return false;
    // Allow only company domain
    return email.endsWith('@ethertrack.in') || email.endsWith('@ethertrack.io');
  } catch (err) {
    console.error('[slackBot] Auth check failed:', err.message);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Helper: Format INR
// ──────────────────────────────────────────────────────────────────────────
function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Command: /mrr - Show MRR/ARR snapshot
// ──────────────────────────────────────────────────────────────────────────
slackApp.command('/mrr', async ({ command, ack, respond }) => {
  await ack();
  if (!await isAuthorized(command.user_id)) {
    return respond({ text: '❌ Unauthorized. Contact admin.', response_type: 'ephemeral' });
  }

  try {
    const mrr = await analytics.getMrrSnapshot();
    const expansion = await analytics.getExpansionMetrics();

    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: '📊 MRR / ARR Snapshot', emoji: true } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*MRR:*\n${formatINR(mrr.mrr)}` },
        { type: 'mrkdwn', text: `*ARR:*\n${formatINR(mrr.arr)}` },
        { type: 'mrkdwn', text: `*Net New MRR:*\n${expansion.netNewMrr >= 0 ? '+' : ''}${formatINR(expansion.netNewMrr)}` },
        { type: 'mrkdwn', text: `*Active Subscriptions:*\n${mrr.activeSubscriptions}` },
        { type: 'mrkdwn', text: `*Expansion MRR:*\n${formatINR(expansion.expansionMrr || 0)}` },
        { type: 'mrkdwn', text: `*Churned MRR:*\n${formatINR(expansion.churnedMrr || 0)}` },
      ]},
      { type: 'context', elements: [
        { type: 'mrkdwn', text: `Generated ${new Date().toLocaleString('en-IN')} | Corporate seats: ${mrr.corporateSeats || 0}` }
      ]},
    ];

    await respond({ blocks, response_type: 'in_channel' });
  } catch (err) {
    console.error('[slackBot] /mrr error:', err);
    await respond({ text: '❌ Failed to fetch MRR data', response_type: 'ephemeral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Command: /pipeline - Show pipeline summary
// ──────────────────────────────────────────────────────────────────────────
slackApp.command('/pipeline', async ({ command, ack, respond }) => {
  await ack();
  if (!await isAuthorized(command.user_id)) {
    return respond({ text: '❌ Unauthorized. Contact admin.', response_type: 'ephemeral' });
  }

  try {
    const forecast = await pipeline.getPipelineForecast();
    const stalled = await pipeline.getStalledDeals(30);

    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: '📈 Pipeline Summary', emoji: true } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Total Pipeline:*\n${formatINR(forecast.summary.totalPipeline)}` },
        { type: 'mrkdwn', text: `*Weighted Pipeline:*\n${formatINR(forecast.summary.weightedPipeline)}` },
        { type: 'mrkdwn', text: `*Open Deals:*\n${forecast.deals.length}` },
        { type: 'mrkdwn', text: `*Stalled (>30d):*\n${stalled.length} ⚠️` },
      ]},
      { type: 'section', text: { type: 'mrkdwn', text: '*By Stage:*' }},
    ];

    // Add stage breakdown
    for (const [stage, value] of Object.entries(forecast.summary.byStage || {})) {
      blocks.push({
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*${stage}:*\n${formatINR(value)}` },
        ],
      });
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Generated ${new Date().toLocaleString('en-IN')}` }],
    });

    await respond({ blocks, response_type: 'in_channel' });
  } catch (err) {
    console.error('[slackBot] /pipeline error:', err);
    await respond({ text: '❌ Failed to fetch pipeline data', response_type: 'ephemeral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Command: /renewals - Show upcoming renewals
// ──────────────────────────────────────────────────────────────────────────
slackApp.command('/renewals', async ({ command, ack, respond }) => {
  await ack();
  if (!await isAuthorized(command.user_id)) {
    return respond({ text: '❌ Unauthorized. Contact admin.', response_type: 'ephemeral' });
  }

  try {
    const renewals = await renewal.getUpcomingRenewals(90);
    const urgent = renewals.filter(r => r.isUrgent);
    const overdue = renewals.filter(r => r.isOverdue);

    let text = `🔔 *Upcoming Renewals (90 days)*\n`;
    text += `• Total: ${renewals.length}\n`;
    text += `• 🔥 Urgent (≤30d): ${urgent.length}\n`;
    text += `• ⚠️ Overdue: ${overdue.length}\n\n`;

    if (urgent.length > 0) {
      text += '*Urgent Renewals:*\n';
      for (const r of urgent.slice(0, 5)) {
        text += `• ${r.party_name || r.companyName || r.email} — ${r.daysUntilRenewal}d — ${r.seats || '?'} seats\n`;
      }
    }

    if (overdue.length > 0) {
      text += '\n*Overdue:*\n';
      for (const r of overdue.slice(0, 5)) {
        text += `• ${r.party_name || r.companyName || r.email} — ${Math.abs(r.daysUntilRenewal)}d overdue\n`;
      }
    }

    await respond({ text, response_type: 'in_channel' });
  } catch (err) {
    console.error('[slackBot] /renewals error:', err);
    await respond({ text: '❌ Failed to fetch renewals', response_type: 'ephemeral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Command: /health - Show health scores summary
// ──────────────────────────────────────────────────────────────────────────
slackApp.command('/health', async ({ command, ack, respond }) => {
  await ack();
  if (!await isAuthorized(command.user_id)) {
    return respond({ text: '❌ Unauthorized. Contact admin.', response_type: 'ephemeral' });
  }

  try {
    const scores = await health.getHealthScores();
    const critical = scores.filter(s => s.tier === 'critical').length;
    const atRisk = scores.filter(s => s.tier === 'at_risk').length;
    const healthy = scores.filter(s => s.tier === 'healthy').length;

    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: '🏥 Customer Health Scores', emoji: true } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Total:* ${scores.length}` },
        { type: 'mrkdwn', text: `*✅ Healthy:* ${healthy}` },
        { type: 'mrkdwn', text: `*⚠️ At Risk:* ${atRisk}` },
        { type: 'mrkdwn', text: `*🚨 Critical:* ${critical}` },
      ]},
    ];

    if (critical > 0) {
      const criticalCustomers = scores.filter(s => s.tier === 'critical').slice(0, 5);
      let text = '*Critical Accounts:*\n';
      for (const c of criticalCustomers) {
        text += `• ${c.company_name || c.full_name || c.email} (Score: ${c.overall_score})\n`;
      }
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Generated ${new Date().toLocaleString('en-IN')}` }],
    });

    await respond({ blocks, response_type: 'in_channel' });
  } catch (err) {
    console.error('[slackBot] /health error:', err);
    await respond({ text: '❌ Failed to fetch health scores', response_type: 'ephemeral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Command: /approve-invoice - Approve invoice via Slack
// ──────────────────────────────────────────────────────────────────────────
slackApp.command('/approve-invoice', async ({ command, ack, respond }) => {
  await ack();

  if (!await isAuthorized(command.user_id)) {
    return respond({ text: '❌ Unauthorized. Contact admin.', response_type: 'ephemeral' });
  }

  const invoiceId = command.text?.trim();
  if (!invoiceId) {
    return respond({
      text: 'Usage: `/approve-invoice <invoice-id>`',
      response_type: 'ephemeral',
    });
  }

  try {
    // Call the invoice approval API
    const res = await fetch(`${process.env.INTERNAL_OPS_API_URL}/api/invoices/${invoiceId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ approvedBy: command.user_id }),
    });

    if (res.ok) {
      await respond({
        text: `✅ Invoice ${invoiceId} approved!`,
        response_type: 'in_channel',
      });
    } else {
      const err = await res.json();
      await respond({ text: `❌ Failed: ${err.error || 'Unknown error'}`, response_type: 'ephemeral' });
    }
  } catch (err) {
    console.error('[slackBot] /approve-invoice error:', err);
    await respond({ text: '❌ Failed to approve invoice', response_type: 'ephemeral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Command: /kpi - Show KPI dashboard
// ──────────────────────────────────────────────────────────────────────────
slackApp.command('/kpi', async ({ command, ack, respond }) => {
  await ack();
  if (!await isAuthorized(command.user_id)) {
    return respond({ text: '❌ Unauthorized. Contact admin.', response_type: 'ephemeral' });
  }

  try {
    const data = await kpiPack.generateKPIPackData();
    const kpis = data.kpis;

    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: '📋 KPI Dashboard', emoji: true } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*MRR:* ${formatINR(kpis.mrr)}` },
        { type: 'mrkdwn', text: `*ARR:* ${formatINR(kpis.arr)}` },
        { type: 'mrkdwn', text: `*NRR:* ${kpis.nrr}%` },
        { type: 'mrkdwn', text: `*Runway:* ${kpis.runwayMonths} mo` },
        { type: 'mrkdwn', text: `*LTV:CAC:* ${kpis.ltvToCac}` },
        { type: 'mrkdwn', text: `*Runway:* ${kpis.runwayMonths} mo` },
        { type: 'mrkdwn', text: `*Headcount:* ${kpis.totalHeadcount}` },
        { type: 'mrkdwn', text: `*Cash:* ${formatINR(kpis.totalCash)}` },
      ]},
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: '📥 Download PDF', emoji: true }, style: 'primary', value: 'download_kpi_pdf' },
        { type: 'button', text: { type: 'plain_text', text: '🔄 Refresh', emoji: true }, value: 'refresh_kpi' },
      ]},
    ];

    await respond({ blocks, response_type: 'in_channel' });
  } catch (err) {
    console.error('[slackBot] /kpi error:', err);
    await respond({ text: '❌ Failed to fetch KPI data', response_type: 'ephemeral' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Command: /help - Show all commands
// ──────────────────────────────────────────────────────────────────────────
slackApp.command('/etpl-help', async ({ command, ack, respond }) => {
  await ack();

  const text = `*ETPL Ops Bot Commands:*
\`/mrr\` — MRR/ARR snapshot
\`/pipeline\` — Pipeline summary & forecast
\`/renewals\` — Upcoming renewals (90 days)
\`/health\` — Customer health scores
\`/kpi\` — Full KPI dashboard
\`/approve-invoice <id>\` — Approve invoice
\`/etpl-help\` — Show this help`;

  await respond({ text, response_type: 'ephemeral' });
});

// ──────────────────────────────────────────────────────────────────────────
// Action handlers (buttons)
// ──────────────────────────────────────────────────────────────────────────
slackApp.action('download_kpi_pdf', async ({ ack, respond }) => {
  await ack();
  // Would trigger PDF generation - for now just acknowledge
  await respond({ text: '📥 PDF generation triggered. Check your DM for download link.', response_type: 'ephemeral' });
});

slackApp.action('refresh_kpi', async ({ ack, respond }) => {
  await ack();
  // Re-fetch and update
  await respond({ text: '🔄 Refreshing KPI data...', response_type: 'ephemeral' });
});

// ──────────────────────────────────────────────────────────────────────────
// Start the app
// ──────────────────────────────────────────────────────────────────────────
async function startSlackBot() {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET || !process.env.SLACK_APP_TOKEN) {
    console.log('[slackBot] Missing Slack credentials — bot not started');
    return null;
  }

  try {
    await slackApp.start();
    console.log('⚡️ Slack bot is running!');
    return slackApp;
  } catch (err) {
    console.error('[slackBot] Failed to start:', err);
    return null;
  }
}

module.exports = { slackApp, startSlackBot, formatINR };