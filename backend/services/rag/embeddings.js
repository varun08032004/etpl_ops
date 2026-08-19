'use strict';

const crypto = require('crypto');

const EMBED_API_URL = process.env.OPENAI_EMBED_URL || process.env.NVIDIA_EMBED_URL || 'http://localhost:8000/v1/embeddings';
const DEFAULT_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || process.env.NEMOTRON_EMBED_MODEL || 'nomic-embed-text';
const CHAT_API_URL = process.env.OPENAI_CHAT_URL || process.env.NVIDIA_CHAT_URL || 'http://localhost:8000/v1/chat/completions';
const DEFAULT_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || process.env.NEMOTRON_CHAT_MODEL || 'llama3.1';
const DEFAULT_BATCH_SIZE = 32;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const EXPECTED_DIMENSIONS = parseInt(process.env.EMBED_DIMENSIONS || '1024', 10);

let embeddingsCache = new Map();
const MAX_CACHE_SIZE = 10000;

function getEmbedApiKey() {
  const key = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error('No embedding API key configured. Set OPENAI_API_KEY or NVIDIA_API_KEY in environment');
  }
  return key;
}

function getChatApiKey() {
  const key = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error('No chat API key configured. Set OPENAI_API_KEY or NVIDIA_API_KEY in environment');
  }
  return key;
}

function getEmbedUrl() {
  const url = process.env.OPENAI_EMBED_URL || process.env.NVIDIA_EMBED_URL;
  if (!url) {
    throw new Error('No embedding endpoint configured. Set OPENAI_EMBED_URL or NVIDIA_EMBED_URL in environment');
  }
  return url;
}

function getChatUrl() {
  const url = process.env.OPENAI_CHAT_URL || process.env.NVIDIA_CHAT_URL;
  if (!url) {
    throw new Error('No chat endpoint configured. Set OPENAI_CHAT_URL or NVIDIA_CHAT_URL in environment');
  }
  return url;
}

function getEmbedModel() {
  return process.env.OPENAI_EMBED_MODEL || process.env.NEMOTRON_EMBED_MODEL || DEFAULT_EMBED_MODEL;
}

function getChatModel() {
  return process.env.OPENAI_CHAT_MODEL || process.env.NEMOTRON_CHAT_MODEL || DEFAULT_CHAT_MODEL;
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function validateEmbeddingDimension(embedding, provider, model) {
  const actualDim = embedding?.length;
  if (actualDim !== EXPECTED_DIMENSIONS) {
    const error = new Error(
      `Embedding dimension mismatch. Provider: ${provider}, Model: ${model}, Expected: ${EXPECTED_DIMENSIONS}, Actual: ${actualDim}. ` +
      `Re-ingest with matching model or update EMBED_DIMENSIONS and re-index.`
    );
    error.code = 'EMBED_DIM_MISMATCH';
    error.provider = provider;
    error.model = model;
    error.expected = EXPECTED_DIMENSIONS;
    error.actual = actualDim;
    throw error;
  }
  return embedding;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, attempt = 1) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Embedding API error (${response.status}): ${errorText}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    if (err.status === 429 || err.status >= 500) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`[embeddings] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`, err.message);
      await sleep(delay);
      return fetchWithRetry(url, options, attempt + 1);
    }
    throw err;
  }
}

async function embedTexts(texts) {
  if (!texts.length) return [];

  const apiKey = getEmbedApiKey();
  const model = getEmbedModel();
  const embedUrl = getEmbedUrl();
  const provider = embedUrl.includes('openai') ? 'openai' : embedUrl.includes('nvidia') ? 'nvidia' : 'custom';

  const uncached = [];
  const uncachedIndices = [];
  const results = new Array(texts.length);

  for (let i = 0; i < texts.length; i++) {
    const hash = hashText(texts[i]);
    if (embeddingsCache.has(hash)) {
      results[i] = embeddingsCache.get(hash);
    } else {
      uncached.push(texts[i]);
      uncachedIndices.push(i);
    }
  }

  if (uncached.length === 0) {
    return results;
  }

  for (let i = 0; i < uncached.length; i += DEFAULT_BATCH_SIZE) {
    const batch = uncached.slice(i, i + DEFAULT_BATCH_SIZE);
    const batchIndices = uncachedIndices.slice(i, i + DEFAULT_BATCH_SIZE);

    const response = await fetchWithRetry(embedUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: batch,
        encoding_format: 'float',
      }),
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Unexpected response format from embeddings API');
    }

    for (let j = 0; j < response.data.length; j++) {
      const rawEmbedding = response.data[j].embedding;
      const validatedEmbedding = validateEmbeddingDimension(rawEmbedding, provider, model);
      const originalIndex = batchIndices[j];
      results[originalIndex] = validatedEmbedding;

      const hash = hashText(batch[j]);
      if (embeddingsCache.size >= MAX_CACHE_SIZE) {
        const firstKey = embeddingsCache.keys().next().value;
        embeddingsCache.delete(firstKey);
      }
      embeddingsCache.set(hash, validatedEmbedding);
    }
  }

  return results;
}

async function embedSingle(text) {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

function clearCache() {
  embeddingsCache.clear();
}

function getCacheStats() {
  return {
    size: embeddingsCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

module.exports = {
  embedTexts,
  embedSingle,
  clearCache,
  getCacheStats,
  hashText,
  validateEmbeddingDimension,
  fetchWithRetry,
  getChatApiKey,
  getChatUrl,
  getChatModel,
  EXPECTED_DIMENSIONS,
};