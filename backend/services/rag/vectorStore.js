'use strict';

const { safeQuery, withTransaction } = require('../../db/pool');
const { embedTexts } = require('./embeddings');
const { hashText } = require('./embeddings');

const DEFAULT_TOP_K = parseInt(process.env.RAG_TOP_K || '8', 10);
const SIMILARITY_THRESHOLD = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.72');

function buildMetadataFilter(user) {
  const conditions = [];
  const params = [];

  const isPrivileged = ['owner', 'admin'].includes(user.role);
  const effectiveRoles = user.effectiveRoles || [];

  if (isPrivileged) {
    return { where: '', params: [] };
  }

  const userDeptCodes = user.deptAccess?.departmentCodes || [];
  const hasDeptAccess = userDeptCodes.length > 0;

  const roleConditions = [];
  if (effectiveRoles.length > 0) {
    const placeholders = effectiveRoles.map((_, i) => `$${params.length + i + 1}`).join(',');
    params.push(...effectiveRoles);
    roleConditions.push(`(metadata->>'role_required') IS NULL OR (metadata->>'role_required') IN (${placeholders})`);
  } else {
    roleConditions.push(`(metadata->>'role_required') IS NULL`);
  }

  if (hasDeptAccess) {
    const placeholders = userDeptCodes.map((_, i) => `$${params.length + i + 1}`).join(',');
    params.push(...userDeptCodes);
    roleConditions.push(`((metadata->>'department_code') IS NULL OR (metadata->>'department_code') IN (${placeholders}))`);
  } else {
    roleConditions.push(`(metadata->>'department_code') IS NULL`);
  }

  roleConditions.push(`((metadata->>'is_public') = 'true')`);

  conditions.push(`(${roleConditions.join(' OR ')})`);

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function upsertChunks(documentId, chunks) {
  if (!chunks.length) return { created: 0, updated: 0 };

  const texts = chunks.map(c => c.content);
  const embeddings = await embedTexts(texts);

  let created = 0;
  let updated = 0;

  await withTransaction(async (client) => {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const contentHash = hashText(chunk.content);

      // Format embedding as PostgreSQL vector literal: [0.1, 0.2, ...]
      const embeddingLiteral = '[' + embedding.join(',') + ']';

      const { rows } = await client.query(
        `INSERT INTO rag_chunks (document_id, chunk_index, section, content, content_hash, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
         ON CONFLICT (document_id, chunk_index, content_hash) DO UPDATE SET
           section = EXCLUDED.section,
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         RETURNING (xmax = 0) AS created`,
        [documentId, chunk.chunkIndex, chunk.section || null, chunk.content, contentHash, embeddingLiteral, JSON.stringify(chunk.metadata || {})]
      );

      if (rows[0].created) {
        created++;
      } else {
        updated++;
      }
    }
  });

  return { created, updated };
}

async function deleteChunksForDocument(documentId) {
  const { rowCount } = await safeQuery(
    `DELETE FROM rag_chunks WHERE document_id = $1`,
    [documentId]
  );
  return rowCount || 0;
}

async function searchSimilar(queryEmbedding, user, options = {}) {
  const topK = options.topK || DEFAULT_TOP_K;
  const threshold = options.threshold || SIMILARITY_THRESHOLD;
  const filter = buildMetadataFilter(user);

  const params = [queryEmbedding, topK, threshold, ...filter.params];
  const paramRefs = params.map((_, i) => `$${i + 1}`).join(', ');

  const query = `
    SELECT
      c.id,
      c.document_id,
      c.chunk_index,
      c.section,
      c.content,
      c.metadata,
      d.document_name,
      d.source_table,
      d.source_id,
      d.department_code,
      1 - (c.embedding <=> $1) AS similarity
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    ${filter.where}
    AND 1 - (c.embedding <=> $1) >= $3
    ORDER BY c.embedding <=> $1
    LIMIT $2
  `;

  const { rows } = await safeQuery(query, params);

  return rows.map(row => ({
    chunkId: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    section: row.section,
    content: row.content,
    metadata: row.metadata,
    documentName: row.document_name,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    departmentCode: row.department_code,
    similarity: parseFloat(row.similarity),
  }));
}

async function getDocument(documentId) {
  const { rows } = await safeQuery(`SELECT * FROM rag_documents WHERE id = $1`, [documentId]);
  return rows[0] || null;
}

async function getChunksForDocument(documentId) {
  const { rows } = await safeQuery(
    `SELECT * FROM rag_chunks WHERE document_id = $1 ORDER BY chunk_index`,
    [documentId]
  );
  return rows;
}

async function upsertDocument(doc) {
  const { rows } = await safeQuery(
    `INSERT INTO rag_documents (source_table, source_id, document_name, department_code, role_required, is_public, content_hash, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (source_table, source_id, version) DO UPDATE SET
       document_name = EXCLUDED.document_name,
       department_code = EXCLUDED.department_code,
       role_required = EXCLUDED.role_required,
       is_public = EXCLUDED.is_public,
       content_hash = EXCLUDED.content_hash,
       updated_at = NOW()
     RETURNING *`,
    [doc.sourceTable, doc.sourceId, doc.documentName, doc.departmentCode || null, doc.roleRequired || null, doc.isPublic || false, doc.contentHash, doc.version || 1]
  );
  return rows[0];
}

async function findDocumentBySource(sourceTable, sourceId, version) {
  const { rows } = await safeQuery(
    `SELECT * FROM rag_documents WHERE source_table = $1 AND source_id = $2 AND version = $3`,
    [sourceTable, sourceId, version || 1]
  );
  return rows[0] || null;
}

async function findDocumentByHash(contentHash) {
  const { rows } = await safeQuery(`SELECT * FROM rag_documents WHERE content_hash = $1`, [contentHash]);
  return rows[0] || null;
}

async function logIngestion(log) {
  await safeQuery(
    `INSERT INTO rag_ingestion_log (source_table, source_id, status, chunks_created, chunks_updated, chunks_deleted, error_message, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [log.sourceTable, log.sourceId || null, log.status, log.chunksCreated || 0, log.chunksUpdated || 0, log.chunksDeleted || 0, log.errorMessage || null]
  );
}

module.exports = {
  upsertChunks,
  deleteChunksForDocument,
  searchSimilar,
  getDocument,
  getChunksForDocument,
  upsertDocument,
  findDocumentBySource,
  findDocumentByHash,
  logIngestion,
  buildMetadataFilter,
};