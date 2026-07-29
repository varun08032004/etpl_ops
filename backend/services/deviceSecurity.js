'use strict';

const crypto = require('crypto');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateOtp() {
  // 6-digit numeric code, zero-padded
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Matches a request IP against an allow-list of bare IPs or IPv4 CIDR
 * ranges (e.g. "203.0.113.4" or "203.0.113.0/24"). IPv6 entries are
 * matched by exact string equality only (no CIDR support) — good enough
 * for a small hand-maintained allow-list; reach for a real IP library if
 * this ever needs to scale beyond a handful of entries.
 */
function ipAllowed(requestIp, allowlist) {
  if (!requestIp || !allowlist || allowlist.length === 0) return false;
  // Normalize IPv4-mapped IPv6 addresses (::ffff:1.2.3.4) which is what
  // Node gives you for IPv4 clients on a dual-stack listener.
  const ip = requestIp.startsWith('::ffff:') ? requestIp.slice(7) : requestIp;

  return allowlist.some((entry) => {
    const trimmed = entry.trim();
    if (trimmed.includes('/')) {
      const [range, bitsStr] = trimmed.split('/');
      const bits = Number(bitsStr);
      const rangeInt = ipv4ToInt(range);
      const ipInt = ipv4ToInt(ip);
      if (rangeInt === null || ipInt === null || Number.isNaN(bits)) return false;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (rangeInt & mask) === (ipInt & mask);
    }
    return trimmed === ip;
  });
}

module.exports = { hashToken, generateDeviceToken, generateOtp, ipAllowed };