'use strict';

const { embedSingle } = require('./embeddings');
const { searchSimilar } = require('./vectorStore');

const MAX_CONTEXT_TOKENS = parseInt(process.env.RAG_MAX_CONTEXT_TOKENS || '4000', 10);
const DEFAULT_TOP_K = parseInt(process.env.RAG_TOP_K || '8', 10);

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function formatChunkForContext(chunk, index) {
  const source = chunk.documentName || 'Unknown Document';
  const section = chunk.section ? ` — ${chunk.section}` : '';
  const preview = chunk.content.length > 500 ? chunk.content.slice(0, 500) + '…' : chunk.content;
  return `[${index}] Source: ${source}${section}\nContent: ${preview}\n`;
}

function buildContext(chunks, maxTokens = MAX_CONTEXT_TOKENS) {
  let context = '';
  let tokenCount = 0;
  const usedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const formatted = formatChunkForContext(chunk, i + 1);
    const chunkTokens = estimateTokens(formatted);

    if (tokenCount + chunkTokens > maxTokens) {
      break;
    }

    context += formatted + '\n';
    tokenCount += chunkTokens;
    usedChunks.push(chunk);
  }

  return { context: context.trim(), usedChunks, tokenCount };
}

function buildRetrievalMetadata(chunks) {
  return chunks.map((chunk, index) => ({
    chunkId: chunk.chunkId,
    documentName: chunk.documentName,
    section: chunk.section,
    sourceTable: chunk.sourceTable,
    sourceId: chunk.sourceId,
    similarity: chunk.similarity,
    contentPreview: chunk.content.slice(0, 200),
    citationIndex: index + 1,
  }));
}

// Input sanitization to prevent injection attacks
function sanitizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  
  // Remove potential prompt injection patterns
  let sanitized = query
    // Remove instruction injection attempts
    .replace(/ignore\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/disregard\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/forget\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/override\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/act\s+as\s+(an?\s+)?(?:assistant|admin|system|developer|root)/gi, '')
    .replace(/pretend\s+to\s+be\s+(?:an?\s+)?(?:assistant|admin|system|developer|root)/gi, '')
    .replace(/you\s+are\s+(?:now\s+)?(?:an?\s+)?(?:assistant|admin|system|developer|root)/gi, '')
    .replace(/system\s*:\s*/gi, '')
    .replace(/assistant\s*:\s*/gi, '')
    .replace(/user\s*:\s*/gi, '')
    // Remove potential XML/HTML injection
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    // Limit length to prevent DoS
    .slice(0, 2000)
    .trim();
  
  return sanitized;
}

async function retrieveContext(query, user, options = {}) {
  // Sanitize the query first
  const sanitizedQuery = sanitizeQuery(query);
  if (!sanitizedQuery) {
    return {
      context: '',
      usedChunks: [],
      retrievalMetadata: [],
      hasSufficientContext: false,
    };
  }

  const topK = options.topK || DEFAULT_TOP_K;
  const threshold = options.threshold;

  const queryEmbedding = await embedSingle(sanitizedQuery);
  const chunks = await searchSimilar(queryEmbedding, user, { topK, threshold });

  if (!chunks.length) {
    return {
      context: '',
      usedChunks: [],
      retrievalMetadata: [],
      hasSufficientContext: false,
    };
  }

  const { context, usedChunks, tokenCount } = buildContext(chunks, options.maxContextTokens || MAX_CONTEXT_TOKENS);
  const retrievalMetadata = buildRetrievalMetadata(usedChunks);

  return {
    context,
    usedChunks,
    retrievalMetadata,
    hasSufficientContext: usedChunks.length > 0,
    tokenCount,
    totalChunksFound: chunks.length,
  };
}

// Sanitize document content before storage to prevent prompt injection via RAG
function sanitizeDocumentContent(content) {
  if (!content || typeof content !== 'string') return '';
  
  return content
    // Remove potential prompt injection patterns
    .replace(/ignore\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/disregard\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/forget\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/override\s+(previous|prior|above|initial)\s+(instructions?|prompts?|rules?)/gi, '')
    .replace(/act\s+as\s+(an?\s+)?(?:assistant|admin|system|developer|root)/gi, '')
    .replace(/pretend\s+to\s+be\s+(?:an?\s+)?(?:assistant|admin|system|developer|root)/gi, '')
    .replace(/you\s+are\s+(?:now\s+)?(?:an?\s+)?(?:assistant|admin|system|developer|root)/gi, '')
    .replace(/system\s*:\s*/gi, '')
    .replace(/assistant\s*:\s*/gi, '')
    .replace(/user\s*:\s*/gi, '')
    // Remove potential XML/HTML injection
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    // Limit length
    .slice(0, 10000)
    .trim();
}

module.exports = {
  retrieveContext,
  buildContext,
  buildRetrievalMetadata,
  estimateTokens,
  formatChunkForContext,
  sanitizeQuery,
  sanitizeDocumentContent,
};

module.exports = {
  retrieveContext,
  buildContext,
  buildRetrievalMetadata,
  estimateTokens,
  formatChunkForContext,
};