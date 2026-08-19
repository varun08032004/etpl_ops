'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { askAssistant } = require('../services/aiAssistant');
const crypto = require('crypto');

router.use(authenticate);

// AI access levels: AI_DISABLED, AI_KNOWLEDGE, AI_AGENT
// Only owner gets AI_AGENT by default; others get AI_DISABLED unless explicitly granted
function checkAIAccess(req, res, next) {
  const access = req.staff.ai_access_level || 'AI_DISABLED';
  if (access === 'AI_DISABLED') {
    return res.status(403).json({ error: 'AI Assistant access not enabled for your account' });
  }
  req.aiAccess = access;
  next();
}

router.use(checkAIAccess);

const ALLOWED_ROLES = ['finance', 'hr', 'admin', 'owner', 'manager', 'employee'];

router.post('/query', requireRole(...ALLOWED_ROLES), async (req, res) => {
  const startTime = Date.now();
  try {
    const { question } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });

    const result = await askAssistant(question.trim(), req.staff);

    await safeQuery(
      `INSERT INTO ai_chat_log (staff_id, question, answer, tools_used, retrieved_chunks, intent, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [
        req.staff.id,
        question.trim(),
        result.answer,
        result.toolsUsed || [],
        JSON.stringify(result.retrievalMetadata || []),
        result.intent || 'unknown',
      ]
    );

    const response = {
      answer: result.answer,
      toolsUsed: result.toolsUsed || [],
      citations: result.citations || [],
      retrievalMetadata: result.retrievalMetadata || [],
      usedLegacy: result.usedLegacy || false,
      hasSufficientContext: result.hasSufficientContext !== false,
      latencyMs: result.latencyMs || (Date.now() - startTime),
      contextTokens: result.contextTokens || 0,
      model: result.model || null,
      type: result.type || 'knowledge',
      intent: result.intent,
    };

    // Handle confirmations
    if (result.confirmations && result.confirmations.length > 0) {
      // Store confirmations in database
      for (const confirmation of result.confirmations) {
        const confirmationId = `confirm_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL
        
        await safeQuery(
          `INSERT INTO ai_confirmations (confirmation_id, staff_account_id, tool_name, parameters, status, created_at, expires_at, original_question, tool_parameters, idempotency_key)
           VALUES ($1, $2, $3, $4, 'PENDING', NOW(), $5, $6, $7, $7)`,
          [
            confirmation.confirmationId || `confirm_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
            req.staff.id,
            confirmation.tool,
            JSON.stringify(confirmation.parameters),
            expiresAt,
            question.trim(),
            JSON.stringify(confirmation.parameters),
            confirmation.confirmationId || `confirm_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
          ]
        );
        
        // Use the generated confirmation ID
        if (!confirmation.confirmationId) {
          confirmation.confirmationId = `confirm_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        }
      }
      
      response.type = 'action_confirmation';
      response.confirmations = result.confirmations;
      response.message = result.message || 'The following actions require confirmation:';
    }

    res.json(response);
  } catch (err) {
    console.error('[ai:query]', err);
    res.status(500).json({ error: err.message || 'Failed to process your question' });
  }
});

// Confirm a pending action
router.post('/confirm/:confirmationId', requireRole(...ALLOWED_ROLES), async (req, res) => {
  try {
    const { confirmationId } = req.params;

    // Fetch the pending confirmation
    const { rows: [confirmation] } = await safeQuery(
      `SELECT * FROM ai_confirmations 
       WHERE confirmation_id = $1 AND status = 'PENDING' AND expires_at > NOW()`,
      [confirmationId]
    );

    if (!confirmation) {
      return res.status(404).json({ error: 'Confirmation not found, expired, or already processed' });
    }

    // Ownership check - only the user who requested the confirmation can confirm it
    if (confirmation.staff_account_id !== req.staff.id) {
      return res.status(403).json({ error: 'You can only confirm your own pending actions' });
    }

    // Check if already processed (replay protection)
    if (confirmation.status !== 'PENDING') {
      return res.status(409).json({ error: `Confirmation already ${confirmation.status.toLowerCase()}` });
    }

    // Execute the confirmed tool
    const result = await askAssistant(confirmation.original_question, { 
      ...req.staff, 
      confirmedTool: confirmation.tool_name, 
      confirmedParams: confirmation.tool_parameters 
    });

    // Mark confirmation as executed
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE ai_confirmations 
         SET status = 'EXECUTED', executed_at = NOW(), executed_by = $1 
         WHERE confirmation_id = $2`,
        [req.staff.id, confirmation.confirmation_id]
      );

      await client.query(
        `INSERT INTO ai_chat_log (staff_id, question, answer, tools_used, retrieved_chunks, intent, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [req.staff.id, confirmation.original_question, result.answer, result.toolsUsed || [], 
         JSON.stringify(result.retrievalMetadata || []), result.intent || 'confirmed']
      );
    });

    res.json({
      answer: result.answer,
      toolsUsed: result.toolsUsed || [],
      citations: result.citations || [],
      retrievalMetadata: result.retrievalMetadata || [],
      usedLegacy: false,
      hasSufficientContext: true,
      type: 'action_result',
    });
  } catch (err) {
    // Mark confirmation as failed
    await safeQuery(
      `UPDATE ai_confirmations SET status = 'REJECTED' WHERE confirmation_id = $1`,
      [confirmationId]
    ).catch(() => {});
    
    console.error('[ai:confirm]', err);
    res.status(500).json({ error: err.message || 'Failed to confirm action' });
  }
});

router.get('/history', requireRole(...ALLOWED_ROLES), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM ai_chat_log WHERE staff_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.staff.id]
    );
    const history = rows.reverse().map(row => ({
      ...row,
      retrieved_chunks: row.retrieved_chunks ? JSON.parse(row.retrieved_chunks) : [],
    }));
    res.json({ history });
  } catch (err) {
    console.error('[ai:history]', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Health check for RAG system
router.get('/health', requireRole(...ALLOWED_ROLES), async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT COUNT(*) as count FROM rag_chunks`);
    const chunkCount = parseInt(rows[0].count, 10);

    const { rows: docRows } = await safeQuery(`SELECT COUNT(*) as count FROM rag_documents`);
    const docCount = parseInt(docRows[0].count, 10);

    res.json({
      status: 'ok',
      ragEnabled: process.env.USE_RAG !== 'false',
      documentsIndexed: docCount,
      chunksIndexed: chunkCount,
      embeddingModel: process.env.OPENAI_EMBED_MODEL || process.env.NEMOTRON_EMBED_MODEL || 'nomic-embed-text',
      generationModel: process.env.OPENAI_CHAT_MODEL || process.env.NEMOTRON_CHAT_MODEL || 'llama3.1',
    });
  } catch (err) {
    console.error('[ai:health]', err);
    res.status(500).json({ error: 'Failed to check RAG health' });
  }
});

module.exports = router;