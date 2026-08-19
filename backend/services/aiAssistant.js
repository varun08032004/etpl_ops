// ─────────────────────────────────────────────────────────────────────────
// services/aiAssistant.js
//
// Production-grade ERP AI Agent with RAG + Tools + Confirmations.
// Uses Nemotron 3 Ultra (or any OpenAI-compatible provider) for generation.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { processQuery } = require('./aiOrchestrator');

async function askAssistant(question, user) {
  const startTime = Date.now();
  try {
    const result = await processQuery(question, user);
    const latency = Date.now() - startTime;

    // Convert orchestrator result to expected format
    const response = {
      answer: result.answer,
      toolsUsed: result.toolsUsed || [],
      citations: result.citations || [],
      retrievalMetadata: result.citations || [],
      usedLegacy: false,
      hasSufficientContext: result.hasSufficientContext,
      latencyMs: latency,
      contextTokens: result.contextTokens || 0,
      model: result.model,
      type: result.type,
      intent: result.intent,
      confirmations: result.confirmations,
      toolResults: result.toolResults,
    };

    // Handle special response types
    if (result.type === 'action_confirmation') {
      response.type = 'action_confirmation';
      response.confirmations = result.confirmations;
      response.message = result.message;
    }

    return response;
  } catch (err) {
    console.error('[aiAssistant] Error:', err.message);
    return {
      answer: err.message || 'Failed to process your question',
      toolsUsed: [],
      citations: [],
      retrievalMetadata: [],
      usedLegacy: false,
      hasSufficientContext: false,
      latencyMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

module.exports = { askAssistant };