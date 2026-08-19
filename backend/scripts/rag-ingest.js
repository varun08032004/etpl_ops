#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────
// scripts/rag-ingest.js — CLI for RAG knowledge base ingestion
// ─────────────────────────────────────────────────────────────────────────

require('dotenv').config();

const { Pool } = require('pg');
const ingestion = require('../services/rag/ingestion');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

pool.on('error', (err) => {
  console.error('[rag-ingest] Unexpected pool error:', err);
});

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';
  const sourceTable = args[1];
  const sourceId = args[2];

  console.log('[rag-ingest] Starting ingestion...');
  console.log('[rag-ingest] Command:', command);
  if (sourceTable) console.log('[rag-ingest] Source:', sourceTable, sourceId || '');

  if (!process.env.NVIDIA_API_KEY) {
    console.error('[rag-ingest] ERROR: NVIDIA_API_KEY not set in environment');
    process.exit(1);
  }

  if (!process.env.INTERNAL_OPS_DATABASE_URL) {
    console.error('[rag-ingest] ERROR: INTERNAL_OPS_DATABASE_URL not set in environment');
    process.exit(1);
  }

  try {
    let result;

    switch (command) {
      case 'full':
        result = await ingestion.runFullIngestion();
        break;

      case 'single':
        if (!sourceTable) {
          console.error('[rag-ingest] ERROR: source_table required for single ingestion');
          console.error('Usage: node scripts/rag-ingest.js single <source_table> [source_id]');
          process.exit(1);
        }
        result = await ingestion.ingestSingleSource(sourceTable, sourceId);
        break;

      case 'templates':
        result = await ingestion.ingestDocumentTemplates();
        break;

      case 'generated':
        result = await ingestion.ingestGeneratedDocuments();
        break;

      case 'documents':
        result = await ingestion.ingestDocuments();
        break;

      case 'compliance':
        result = await ingestion.ingestComplianceSettings();
        break;

      case 'appsettings':
        result = await ingestion.ingestAppSettings();
        break;

      case 'tax':
        result = await ingestion.ingestTaxSlabs();
        break;

      case 'pt':
        result = await ingestion.ingestPtSlabs();
        break;

      case 'company':
        result = await ingestion.ingestCompanyProfile();
        break;

      case 'health':
        const { vectorStore } = require('../services/rag');
        const { rows: chunkRows } = await pool.query('SELECT COUNT(*) as count FROM rag_chunks');
        const { rows: docRows } = await pool.query('SELECT COUNT(*) as count FROM rag_documents');
        console.log('[rag-ingest] Health check:');
        console.log('  Documents indexed:', docRows[0].count);
        console.log('  Chunks indexed:', chunkRows[0].count);
        console.log('  Embedding model:', process.env.NEMOTRON_EMBED_MODEL || 'nvidia/nemotron-3-ultra-embed');
        process.exit(0);
        break;

      default:
        console.error('[rag-ingest] ERROR: Unknown command:', command);
        console.error('Available commands: full, single, templates, generated, documents, compliance, appsettings, tax, pt, company, health');
        process.exit(1);
    }

    console.log('[rag-ingest] Ingestion completed successfully');
    console.log('[rag-ingest] Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[rag-ingest] Ingestion failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();