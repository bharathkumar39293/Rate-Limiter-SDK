import { RequestHandler } from 'express';
import { pool } from '../db/pool';
import { hashKey } from '../services/keys';

declare global {
  namespace Express {
    interface Request {
      auth?: { apiKeyId: number; tenantName: string };
    }
  }
}

// Database-authoritative authentication deliberately avoids stale positive caches.
// Authentication failures must never use the rate limiter's fail-open behavior.
export const requireApiKey: RequestHandler = async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (typeof key !== 'string' || !/^rl_live_[a-f0-9]{32}$/.test(key)) {
    res.status(401).json({ error: 'A valid API key is required' });
    return;
  }
  try {
    const result = await pool.query(
      'SELECT id, tenant_name FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
      [hashKey(key)]
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'A valid API key is required' });
      return;
    }
    req.auth = { apiKeyId: result.rows[0].id, tenantName: result.rows[0].tenant_name };
    next();
  } catch {
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
};
