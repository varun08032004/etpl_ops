'use strict';

const { safeQuery } = require('../db/pool');

const IDEMPOTENCY_TTL_HOURS = 24;

function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }

  const endpoint = req.originalUrl || req.url;

  safeQuery(
    `SELECT response_body, response_code FROM idempotency_keys 
     WHERE key = $1 AND endpoint = $2 AND expires_at > NOW()`,
    [idempotencyKey, endpoint]
  ).then(({ rows }) => {
    if (rows.length > 0) {
      const { response_body, response_code } = rows[0];
      res.setHeader('X-Idempotency-Replay', 'true');
      return res.status(response_code).json(response_body);
    }
    next();
  }).catch(err => {
    console.error('[idempotency] lookup failed:', err.message);
    next();
  });
}

async function storeIdempotencyResponse(key, endpoint, responseBody, responseCode) {
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
  
  try {
    await safeQuery(
      `INSERT INTO idempotency_keys (key, endpoint, response_body, response_code, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO NOTHING`,
      [key, endpoint, JSON.stringify(responseBody), responseCode, expiresAt]
    );
  } catch (err) {
    console.error('[idempotency] store failed:', err.message);
  }
}

function withIdempotency(handler) {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
    const endpoint = req.originalUrl || req.url;

    if (!idempotencyKey) {
      return handler(req, res, next);
    }

    try {
      const { rows } = await safeQuery(
        `SELECT response_body, response_code FROM idempotency_keys 
         WHERE key = $1 AND endpoint = $2 AND expires_at > NOW()`,
        [idempotencyKey, endpoint]
      );

      if (rows.length > 0) {
        const { response_body, response_code } = rows[0];
        res.setHeader('X-Idempotency-Replay', 'true');
        return res.status(response_code).json(response_body);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        storeIdempotencyResponse(idempotencyKey, endpoint, body, res.statusCode).catch(() => {});
        return originalJson(body);
      };

      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  idempotencyMiddleware,
  storeIdempotencyResponse,
  withIdempotency
};