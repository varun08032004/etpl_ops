'use strict';

const sharp = require('sharp');

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn('[document-engine] image fetch returned', res.status, url);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn('[document-engine] could not fetch image (timed out or network error):', url, err.message);
    return null;
  }
}

async function sanitizeImageForPdf(buffer, label) {
  if (!buffer) return null;
  try {
    return await sharp(buffer)
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .png({ progressive: false, interlace: false })
      .toBuffer();
  } catch (err) {
    console.warn(`[document-engine] could not sanitize image (${label}), skipping it entirely to avoid a possible PDFKit hang:`, err.message);
    return null;
  }
}

module.exports = { fetchImageBuffer, sanitizeImageForPdf };