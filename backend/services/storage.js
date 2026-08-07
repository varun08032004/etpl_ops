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

function assertConfigured() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env for document uploads');
  }
}

async function uploadFile(path, buffer, mimeType, bucket = BUCKET) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
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

async function getSignedUrl(path, expiresInSeconds = 3600, bucket = BUCKET) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase Storage sign failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

async function deleteFile(path, bucket = BUCKET) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase Storage delete failed (${res.status}): ${text}`);
  }
}

module.exports = { uploadFile, getSignedUrl, deleteFile, SCREENSHOTS_BUCKET };