'use strict';

// The agent authenticates with the SAME staff_accounts credentials as the
// portal (one login for an employee, not a second user system), but gets a
// DIFFERENT token: longer-lived (so "auto-login on boot" doesn't need the
// employee to re-type their password every morning) and scoped to a single
// agent_devices row so it can be revoked per-device without touching the
// employee's portal session. `typ: 'agent'` keeps the two token kinds from
// ever being interchangeable — a leaked portal token can't call agent
// endpoints and vice versa.

const jwt = require('jsonwebtoken');
const { safeQuery } = require('../db/pool');

const JWT_SECRET = process.env.INTERNAL_OPS_JWT_SECRET;
const AGENT_TOKEN_TTL = '30d';

function signAgentToken({ staffId, employeeId, deviceId }) {
  return jwt.sign(
    { sub: staffId, employee_id: employeeId, device_id: deviceId, typ: 'agent' },
    JWT_SECRET || 'dev-only-insecure-secret',
    { expiresIn: AGENT_TOKEN_TTL }
  );
}

async function authenticateAgent(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET || 'dev-only-insecure-secret');
    if (decoded.typ !== 'agent') return res.status(401).json({ error: 'Invalid token type' });

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

    req.agent = { staffId: row.staff_id, employeeId: row.employee_id, deviceId: row.device_id };
    next();
  } catch (err) {
    // This used to return the same generic message for every failure mode
    // (expired token, wrong secret after a restart, a DB error) which made
    // it impossible to tell them apart from the client side. Logging the
    // real cause here doesn't change what the agent sees, but means
    // "Invalid or expired token" repeating in the agent's logs is now
    // actually diagnosable from the backend's logs.
    console.error('[agentAuth]', err.name, err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signAgentToken, authenticateAgent };