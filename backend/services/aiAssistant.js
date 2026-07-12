// ─────────────────────────────────────────────────────────────────────────
// services/aiAssistant.js
//
// Natural-language queries over ETPL's own data — P&L, trial balance,
// overdue invoices, headcount, payroll, sales pipeline. Deliberately built
// as a tool-use loop against a small fixed set of read-only query functions,
// NOT free-form SQL generation — that would be a real prompt-injection /
// data-leak risk (a cleverly-phrased question could otherwise trick a
// SQL-writing model into reading tables it shouldn't). Every tool here is
// hand-written and scoped to exactly what it's meant to return.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { safeQuery } = require('../db/pool');
const ledger = require('./ledger');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const TOOLS = [
  {
    name: 'get_profit_and_loss',
    description: 'Get income, expenses, and net profit for a date range.',
    input_schema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_trial_balance',
    description: 'Get the trial balance (all account balances) as of a date, or all-time if no date given.',
    input_schema: {
      type: 'object',
      properties: { as_of_date: { type: 'string', description: 'YYYY-MM-DD, optional' } },
    },
  },
  {
    name: 'get_balance_sheet',
    description: 'Get assets, liabilities, and equity as of a date.',
    input_schema: {
      type: 'object',
      properties: { as_of_date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' } },
    },
  },
  {
    name: 'get_overdue_invoices',
    description: 'List invoices that are currently overdue, with amounts and customer names.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_headcount_summary',
    description: 'Get employee headcount broken down by department and employment status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_payroll_summary',
    description: 'Get payroll totals (gross, deductions, net) for a specific month/year.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'integer', description: '1-12' },
        year: { type: 'integer', description: 'e.g. 2026' },
      },
      required: ['month', 'year'],
    },
  },
  {
    name: 'get_sales_pipeline_summary',
    description: 'Get the current sales pipeline: open deals by stage, weighted forecast value, and recently won/lost deals.',
    input_schema: { type: 'object', properties: {} },
  },
];

async function executeTool(name, input) {
  switch (name) {
    case 'get_profit_and_loss':
      return ledger.getProfitAndLoss(input.from_date, input.to_date);

    case 'get_trial_balance':
      return ledger.getTrialBalance(input.as_of_date || null);

    case 'get_balance_sheet':
      return ledger.getBalanceSheet(input.as_of_date || new Date().toISOString().slice(0, 10));

    case 'get_overdue_invoices': {
      const { rows } = await safeQuery(
        `SELECT i.invoice_number, p.name AS customer, i.total_amount, i.amount_paid, i.due_date
         FROM invoices i JOIN parties p ON p.id = i.party_id
         WHERE i.status = 'overdue' ORDER BY i.due_date ASC`
      );
      return { overdueInvoices: rows, count: rows.length };
    }

    case 'get_headcount_summary': {
      const { rows } = await safeQuery(
        `SELECT d.name AS department, e.status, COUNT(*) AS count
         FROM employees e LEFT JOIN departments d ON d.id = e.department_id
         GROUP BY d.name, e.status ORDER BY d.name`
      );
      return { breakdown: rows };
    }

    case 'get_payroll_summary': {
      const { rows: [run] } = await safeQuery(
        `SELECT * FROM payroll_runs WHERE period_month = $1 AND period_year = $2`,
        [input.month, input.year]
      );
      if (!run) return { found: false, message: 'No payroll run exists for that period' };
      return { found: true, totalGross: run.total_gross, totalDeductions: run.total_deductions, totalNet: run.total_net, status: run.status };
    }

    case 'get_sales_pipeline_summary': {
      const { rows: byStage } = await safeQuery(
        `SELECT stage, COUNT(*) AS deal_count, COALESCE(SUM(deal_value),0) AS total_value,
                COALESCE(SUM(deal_value * probability_percent / 100),0) AS weighted_value
         FROM deals WHERE stage NOT IN ('won','lost') GROUP BY stage`
      );
      const { rows: recentWon } = await safeQuery(
        `SELECT company_name, deal_value, updated_at FROM deals WHERE stage = 'won' ORDER BY updated_at DESC LIMIT 5`
      );
      return { openPipelineByStage: byStage, recentlyWon: recentWon };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function askAssistant(question) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured in .env — the AI Assistant needs its own Anthropic API key');
  }

  const systemPrompt = `You are an internal financial/operations assistant for EtherTrack Technologies Private Limited (ETPL), an Indian software company. Answer questions using ONLY the tools provided — never guess or use outside knowledge for company-specific figures. All amounts are in INR. Be concise and cite exact numbers from tool results. Today's date context should come from the tool results, not assumptions. If a question needs data you don't have a tool for, say so plainly rather than guessing.`;

  let messages = [{ role: 'user', content: question }];
  const toolsUsed = [];
  let finalText = '';

  for (let iteration = 0; iteration < 6; iteration++) {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    messages.push({ role: 'assistant', content: data.content });

    if (data.stop_reason !== 'tool_use') {
      finalText = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      break;
    }

    const toolResults = [];
    for (const block of data.content) {
      if (block.type !== 'tool_use') continue;
      toolsUsed.push(block.name);
      try {
        const result = await executeTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      } catch (err) {
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { answer: finalText || 'I was not able to complete that request within the tool-call limit — try breaking it into a simpler question.', toolsUsed };
}

module.exports = { askAssistant };