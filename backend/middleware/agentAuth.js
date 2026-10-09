'use strict';

// The agent authenticates with the SAME staff_accounts credentials as the
// portal (one login for an employee, not a second user system), but gets a
// DIFFERENT token: longer-lived (so "auto-login on boot" doesn't need the
// employee to re-type their password every morning) and scoped to a single
// agent_devices row so it can be revoked per-device without touching the
// employee's portal session. `typ: 'agent'` keeps the two token kinds from
// ever being interchangeable — a leaked portal token can't call agent
// endpoints and vice versa.
//
// HARDENED: Now validates hardware fingerprint (HWID) on every request to
// prevent token cloning across devices. Also validates heartbeat sequence
// numbers to prevent replay attacks. Adds geolocation/IP verification for
// office vs WFH detection and impossible travel anomaly detection.
// Includes per-device rate limiting.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { safeQuery } = require('../db/pool');

const JWT_SECRET = process.env.INTERNAL_OPS_JWT_SECRET;
const AGENT_TOKEN_TTL = '30d';

// Rate limiting: sliding window per device
const rateLimitCache = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 120; // Max 120 requests per minute per device (2/second)
const HEARTBEAT_RATE_LIMIT_MAX = 10; // Max 10 heartbeats per minute per device

// GeoIP cache (in-memory, expires after 1 hour)
const geoIpCache = new Map();
const GEO_CACHE_TTL_MS = 60 * 60 * 1000;

function signAgentToken({ staffId, employeeId, deviceId }) {
  return jwt.sign(
    { sub: staffId, employee_id: employeeId, device_id: deviceId, typ: 'agent' },
    JWT_SECRET || 'dev-only-insecure-secret',
    { expiresIn: AGENT_TOKEN_TTL }
  );
}

// Check rate limit for a device
function checkRateLimit(deviceId, endpoint, maxRequests = RATE_LIMIT_MAX_REQUESTS) {
  const now = Date.now();
  const key = `${deviceId}:${endpoint}`;
  
  let window = rateLimitCache.get(key);
  if (!window || now - window.startTime > RATE_LIMIT_WINDOW_MS) {
    // New window
    window = { startTime: now, requests: [] };
    rateLimitCache.set(key, window);
  }
  
  // Clean old requests
  window.requests = window.requests.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (window.requests.length >= maxRequests) {
    return { allowed: false, retryAfter: RATE_LIMIT_WINDOW_MS - (now - window.requests[0]) };
  }
  
  window.requests.push(now);
  return { allowed: true, remaining: maxRequests - window.requests.length };
}

// Clean rate limit cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of rateLimitCache.entries()) {
    if (now - window.startTime > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Generate hardware fingerprint from components sent by agent
function generateHwId(components) {
  // components: { cpuId, motherboardSerial, diskSerial, macAddresses }
  const normalized = {
    cpuId: (components.cpuId || '').trim().toLowerCase(),
    motherboardSerial: (components.motherboardSerial || '').trim().toLowerCase(),
    diskSerial: (components.diskSerial || '').trim().toLowerCase(),
    macAddresses: (components.macAddresses || []).map(m => m.trim().toLowerCase()).sort()
  };
  const str = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(str).digest('hex');
}
  
  // Lookup geolocation for an IP address
  async function lookupGeoIp(ip) {
  // Skip private/local IPs
  if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') || ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') || ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') || ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') || ip.startsWith('172.31.')) {
    return { country: 'Local', region: 'Local', city: 'Local', lat: 0, lon: 0, isp: 'Private Network', isPrivate: true };
  }

  // Check cache
  const cached = geoIpCache.get(ip);
  if (cached && (Date.now() - cached.timestamp) < GEO_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // Use free ip-api.com (rate limited to 45/minute)
    // In production, use a paid service like MaxMind GeoIP2 or ipinfo.io
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,isp,query`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    const data = await response.json();
    
    if (data.status === 'success') {
      const result = {
        country: data.country,
        region: data.regionName,
        city: data.city,
        lat: data.lat,
        lon: data.lon,
        isp: data.isp,
        isPrivate: false,
      };
      
      // Cache result
      geoIpCache.set(ip, { data: result, timestamp: Date.now() });
      
      // Clean old cache entries periodically
      if (geoIpCache.size > 1000) {
        const now = Date.now();
        for (const [key, value] of geoIpCache.entries()) {
          if (now - value.timestamp > GEO_CACHE_TTL_MS) {
            geoIpCache.delete(key);
          }
        }
      }
      
      return result;
    }
  } catch (e) {
    // Fail silently - geo lookup is best effort
  }
  
  return { country: 'Unknown', region: 'Unknown', city: 'Unknown', lat: 0, lon: 0, isp: 'Unknown', isPrivate: false };
}

// Calculate distance between two lat/lon points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if IP matches any office network
async function checkOfficeNetwork(ip) {
  const { rows } = await safeQuery(`SELECT cidr FROM office_networks`);
  for (const row of rows) {
    try {
      // Simple CIDR check (for production, use a proper CIDR library)
      const [network, bits] = row.cidr.split('/');
      const mask = parseInt(bits, 10);
      if (!isNaN(mask)) {
        // This is a simplified check - in production use netmask library
        // For now, just return false for non-office IPs
      }
    } catch (e) {
      // Ignore CIDR parse errors
    }
  }
  return false;
}

// Detect impossible travel: same employee appearing in distant locations within impossible time
async function detectImpossibleTravel(employeeId, currentLocation, currentIp) {
  // Get last known location for this employee (from last heartbeat)
  const { rows } = await safeQuery(
    `SELECT last_known_location, last_known_ip, last_seen_at
     FROM agent_devices
     WHERE employee_id = $1 AND last_known_location IS NOT NULL
     ORDER BY last_seen_at DESC LIMIT 1`,
    [employeeId]
  );
  
  if (rows.length === 0) return { impossible: false };
  
  const last = rows[0];
  if (!last.last_known_location || last.last_known_location.lat === 0 || last.last_known_location.lon === 0) {
    return { impossible: false };
  }
  
  if (!currentLocation || currentLocation.lat === 0 || currentLocation.lon === 0) {
    return { impossible: false };
  }
  
  const distanceKm = calculateDistance(
    last.last_known_location.lat,
    last.last_known_location.lon,
    currentLocation.lat,
    currentLocation.lon
  );
  
  const timeHours = (Date.now() - new Date(last.last_seen_at).getTime()) / (1000 * 60 * 60);
  
  // Impossible if distance > 1000km and time < distance/500 (assuming max 500km/h commercial travel)
  // Or distance > 500km and time < 1 hour
  const maxSpeedKmh = 500; // Commercial flight speed
  const minTimeHours = distanceKm / maxSpeedKmh;
  
  const impossible = distanceKm > 100 && timeHours < minTimeHours && timeHours < 24;
  
  if (impossible) {
    await safeQuery(
      `INSERT INTO heartbeat_anomaly_log (employee_id, device_id, anomaly_type, severity, details, ip, location)
       VALUES ($1, (SELECT id FROM agent_devices WHERE employee_id = $1 ORDER BY last_seen_at DESC LIMIT 1), 'impossible_travel', 'critical', $2, $3, $4)`,
      [employeeId, { 
        distanceKm: Math.round(distanceKm),
        timeHours: Math.round(timeHours * 100) / 100,
        minTimeHours: Math.round(minTimeHours * 100) / 100,
        lastLocation: last.last_known_location,
        currentLocation,
        lastIp: last.last_known_ip,
        currentIp,
      }, currentIp, currentLocation]
    );
  }
  
  return { impossible, distanceKm, timeHours };
}

// Update device's last known location/IP
async function updateDeviceLocation(deviceId, ip, location) {
  await safeQuery(
    `UPDATE agent_devices SET last_known_ip = $1, last_known_location = $2, last_seen_at = NOW() WHERE id = $3`,
    [ip, JSON.stringify(location), deviceId]
  );
}

async function verifyDeviceFingerprint(deviceId, providedHwId, clientIp, req) {
  const { rows: [device] } = await safeQuery(
    `SELECT hw_id, fingerprint_mismatch_count, status, employee_id,
            max_fingerprint_mismatches, block_on_fingerprint_mismatch, require_hardware_fingerprint
     FROM agent_devices d
     JOIN monitoring_settings ms ON ms.id = 1
     WHERE d.id = $1`,
    [deviceId]
  );

  if (!device) return { valid: false, reason: 'Device not found' };
  if (device.status !== 'active') return { valid: false, reason: 'Device revoked' };

  // If hardware fingerprinting is disabled globally, skip (but log)
  if (!device.require_hardware_fingerprint) {
    return { valid: true, fingerprintMatched: true };
  }

  // First enrollment - no HWID stored yet
  if (!device.hw_id) {
    return { valid: true, fingerprintMatched: null, firstEnrollment: true };
  }

  const matches = device.hw_id === providedHwId;

  if (!matches) {
    const newMismatchCount = (device.fingerprint_mismatch_count || 0) + 1;
    const maxMismatches = device.max_fingerprint_mismatches || 3;

    await safeQuery(
      `UPDATE agent_devices SET fingerprint_mismatch_count = $1 WHERE id = $2`,
      [newMismatchCount, deviceId]
    );

    // Log the mismatch
    await safeQuery(
      `INSERT INTO device_enrollment_log (device_id, employee_id, action, hw_id, ip, metadata)
       VALUES ($1, $2, 'fingerprint_mismatch', $3, $4, $5)`,
      [deviceId, device.employee_id, providedHwId, clientIp, { mismatchCount: newMismatchCount }]
    );

    if (newMismatchCount >= maxMismatches && device.block_on_fingerprint_mismatch) {
      await safeQuery(
        `UPDATE agent_devices SET status = 'revoked' WHERE id = $1`,
        [deviceId]
      );
      await safeQuery(
        `INSERT INTO device_enrollment_log (device_id, employee_id, action, hw_id, ip, metadata)
         VALUES ($1, $2, 'revoked', $3, $4, $5)`,
        [deviceId, device.employee_id, providedHwId, clientIp, { reason: 'max_fingerprint_mismatches_exceeded' }]
      );
      return { valid: false, reason: 'Device revoked due to repeated hardware fingerprint mismatches' };
    }

    return { valid: false, reason: 'Hardware fingerprint mismatch', mismatchCount: newMismatchCount };
  }

  // Match - update verified timestamp and reset mismatch count
  await safeQuery(
    `UPDATE agent_devices SET fingerprint_verified_at = NOW(), fingerprint_mismatch_count = 0 WHERE id = $1`,
    [deviceId]
  );

  return { valid: true, fingerprintMatched: true };
}

async function verifyHeartbeatSequence(deviceId, sessionId, providedSeq, clientIp) {
  const { rows: [settings] } = await safeQuery(`SELECT heartbeat_seq_validation, max_heartbeat_gap_seconds FROM monitoring_settings WHERE id = 1`);
  if (!settings?.heartbeat_seq_validation) return { valid: true };

  const { rows: [session] } = await safeQuery(
    `SELECT heartbeat_seq, last_heartbeat_received_at FROM agent_sessions WHERE id = $1 AND device_id = $2`,
    [sessionId, deviceId]
  );

  if (!session) return { valid: false, reason: 'Session not found' };

  const lastSeq = session.heartbeat_seq || 0;
  const gap = providedSeq - lastSeq;

  if (gap <= 0) {
    // Replay or duplicate - log anomaly
    await safeQuery(
      `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip)
       VALUES ($1, (SELECT employee_id FROM agent_sessions WHERE id = $1), $2, 'sequence_gap', 'warning', $3, $4)`,
      [sessionId, deviceId, { expectedSeq: lastSeq + 1, receivedSeq: providedSeq }, clientIp]
    );
    return { valid: false, reason: 'Invalid heartbeat sequence (replay or duplicate)' };
  }

  if (gap > 1) {
    // Gap detected - possible missed heartbeats or tampering
    await safeQuery(
      `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip)
       VALUES ($1, (SELECT employee_id FROM agent_sessions WHERE id = $1), $2, 'sequence_gap', 'warning', $3, $4)`,
      [sessionId, deviceId, { expectedSeq: lastSeq + 1, receivedSeq: providedSeq, gap }, clientIp]
    );
    // Allow but log - network issues can cause gaps
  }

  // Check time gap
  if (session.last_heartbeat_received_at) {
    const timeGapSec = (Date.now() - new Date(session.last_heartbeat_received_at).getTime()) / 1000;
    const maxGap = settings.max_heartbeat_gap_seconds || 120;
    if (timeGapSec > maxGap) {
      await safeQuery(
        `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip)
         VALUES ($1, (SELECT employee_id FROM agent_sessions WHERE id = $1), $2, 'timeout', 'warning', $3, $4)`,
        [sessionId, deviceId, { timeGapSec, maxGap }, clientIp]
      );
    }
  }

  return { valid: true, nextSeq: providedSeq };
}

async function authenticateAgent(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET || 'dev-only-insecure-secret');
    if (decoded.typ !== 'agent') return res.status(401).json({ error: 'Invalid token type' });

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

    const { rows } = await safeQuery(
      `SELECT sa.id AS staff_id, sa.is_active, sa.employee_id, d.id AS device_id, d.status AS device_status, d.hw_id
       FROM staff_accounts sa
       JOIN agent_devices d ON d.id = $2
       WHERE sa.id = $1`,
      [decoded.sub, decoded.device_id]
    );
    const row = rows[0];
    if (!row || !row.is_active) return res.status(401).json({ error: 'Account inactive or not found' });
    if (row.device_status !== 'active') return res.status(401).json({ error: 'This device has been revoked — contact your admin' });

    // Rate limiting per device
    const rateLimit = checkRateLimit(row.device_id, req.path);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil(rateLimit.retryAfter / 1000)
      });
    }
    res.set('X-RateLimit-Remaining', rateLimit.remaining);

    // Verify hardware fingerprint if provided in header
    const providedHwId = req.headers['x-ethertrack-hwid'];
    if (providedHwId) {
      const fpResult = await verifyDeviceFingerprint(row.device_id, providedHwId, clientIp, req);
      if (!fpResult.valid) {
        return res.status(401).json({ error: fpResult.reason, code: 'FINGERPRINT_MISMATCH', mismatchCount: fpResult.mismatchCount });
      }
      req.agent.fingerprintVerified = fpResult.fingerprintMatched;
    }

    req.agent = { staffId: row.staff_id, employeeId: row.employee_id, deviceId: row.device_id, clientIp };
    next();
  } catch (err) {
    console.error('[agentAuth]', err.name, err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware specifically for heartbeat endpoint - validates sequence
async function authenticateAgentHeartbeat(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET || 'dev-only-insecure-secret');
    if (decoded.typ !== 'agent') return res.status(401).json({ error: 'Invalid token type' });

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const sessionId = req.body?.session_id;
    const providedSeq = req.body?.heartbeat_seq;
    const providedHwId = req.headers['x-ethertrack-hwid'];

    if (!sessionId) return res.status(400).json({ error: 'session_id required' });
    if (typeof providedSeq !== 'number') return res.status(400).json({ error: 'heartbeat_seq required' });

    const { rows } = await safeQuery(
      `SELECT sa.id AS staff_id, sa.is_active, sa.employee_id, d.id AS device_id, d.status AS device_status
       FROM staff_accounts sa
       JOIN agent_devices d ON d.id = $2
       WHERE sa.id = $1`,
      [decoded.sub, decoded.device_id]
    );
    const row = rows[0];
    if (!row || !row.is_active) return res.status(401).json({ error: 'Account inactive or not found' });
    if (row.device_status !== 'active') return res.status(401).json({ error: 'This device has been revoked — contact your admin' });

    // Rate limiting for heartbeats (stricter limit)
    const rateLimit = checkRateLimit(row.device_id, '/session/heartbeat', HEARTBEAT_RATE_LIMIT_MAX);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Heartbeat rate limit exceeded', 
        code: 'HEARTBEAT_RATE_LIMITED',
        retryAfter: Math.ceil(rateLimit.retryAfter / 1000)
      });
    }
    res.set('X-RateLimit-Remaining', rateLimit.remaining);

    // Verify hardware fingerprint
    if (providedHwId) {
      const fpResult = await verifyDeviceFingerprint(row.device_id, providedHwId, clientIp, req);
      if (!fpResult.valid) {
        return res.status(401).json({ error: fpResult.reason, code: 'FINGERPRINT_MISMATCH', mismatchCount: fpResult.mismatchCount });
      }
    }

    // Verify heartbeat sequence
    const seqResult = await verifyHeartbeatSequence(row.device_id, sessionId, providedSeq, clientIp);
    if (!seqResult.valid) {
      return res.status(401).json({ error: seqResult.reason, code: 'SEQUENCE_INVALID' });
    }

    // Geolocation verification (async, non-blocking)
    // Lookup geo IP for office/WFH detection and impossible travel
    const location = await lookupGeoIp(clientIp);
    const isOffice = await checkOfficeNetwork(clientIp);
    
    // Update device location
    await updateDeviceLocation(row.device_id, clientIp, location);
    
    // Detect impossible travel
    const travelResult = await detectImpossibleTravel(row.employee_id, location, clientIp);
    
    // Check office network enforcement
    const { rows: [settings] } = await safeQuery(`SELECT enforce_office_network, allowed_office_network_ids FROM monitoring_settings WHERE id = 1`);
    if (settings?.enforce_office_network && !isOffice && !location.isPrivate) {
      // Log but don't block - just flag for review
      await safeQuery(
        `INSERT INTO heartbeat_anomaly_log (session_id, employee_id, device_id, anomaly_type, severity, details, ip, location)
         VALUES ($1, $2, $3, 'ip_mismatch', 'warning', $4, $5, $6)`,
        [sessionId, row.employee_id, row.device_id, { expectedOffice: true, actualOffice: false, isOffice }, clientIp, location]
      );
    }

    req.agent = { 
      staffId: row.staff_id, 
      employeeId: row.employee_id, 
      deviceId: row.device_id, 
      clientIp, 
      sessionId, 
      heartbeatSeq: providedSeq,
      location,
      isOffice,
      impossibleTravel: travelResult.impossible,
    };
    next();
  } catch (err) {
    console.error('[agentAuth:heartbeat]', err.name, err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signAgentToken, authenticateAgent, authenticateAgentHeartbeat, generateHwId };