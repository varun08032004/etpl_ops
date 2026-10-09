'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'Documents';

// Screenshots get their own bucket rather than living inside 'Documents' —
// different retention/access-control needs (should be easy to bulk-purge
// old ones, and viewing them is gated by monitoring permissions, not the
// documents module's ACL). Create this bucket once in Supabase Storage
// before enabling screenshots. Every existing call in the codebase omits
// the `bucket` param and keeps hitting 'Documents' exactly as before.
const SCREENSHOTS_BUCKET = 'Screenshots';

// Supabase reports a missing object as HTTP 400 with statusCode "404" in the
// body, so a plain `res.status === 404` check misses it. Detect it from the body.
const NOT_FOUND_RE = /not_found|NoSuchKey|Object not found/i;

class StorageNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageNotFoundError';
    this.code = 'STORAGE_NOT_FOUND';
  }
}

function isNotFoundError(err) {
  return err instanceof StorageNotFoundError || err?.code === 'STORAGE_NOT_FOUND';
}

// Node's fetch only says "fetch failed" on network errors. The real reason
// (ENOTFOUND, ECONNREFUSED, ETIMEDOUT, certificate problem...) is in err.cause.
async function sfetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    const reason = err.cause?.code || err.cause?.message || err.message;
    let host = url;
    try { host = new URL(url).host; } catch (_) { /* keep raw url */ }
    console.error('[storage] network error:', host, err.cause || err);
    throw new Error(`Cannot reach Supabase Storage at ${host} (${reason})`);
  }
}

function assertConfigured() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env for document uploads');
  }
}

async function uploadFile(path, buffer, mimeType, bucket = BUCKET) {
  assertConfigured();
  const res = await sfetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase Storage upload failed (${res.status}): ${text}`);
  }
  return path;
}

// Returns the raw file as { buffer, contentType }. Used to serve ID photos.
async function downloadFile(path, bucket = BUCKET) {
  assertConfigured();
  const res = await sfetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    if (NOT_FOUND_RE.test(text)) {
      throw new StorageNotFoundError(`File not found in storage: ${path}`);
    }
    throw new Error(`Supabase Storage download failed (${res.status}): ${text}`);
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type'),
  };
}

async function getSignedUrl(path, expiresInSeconds = 3600, bucket = BUCKET) {
  assertConfigured();
  const res = await sfetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (NOT_FOUND_RE.test(text)) {
      throw new StorageNotFoundError(`File not found in storage: ${path}`);
    }
    throw new Error(`Supabase Storage sign failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

async function deleteFile(path, bucket = BUCKET) {
  assertConfigured();
  const res = await sfetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase Storage delete failed (${res.status}): ${text}`);
  }
}

module.exports = {
  uploadFile,
  downloadFile,
  getSignedUrl,
  deleteFile,
  isNotFoundError,
  StorageNotFoundError,
  SCREENSHOTS_BUCKET,
};