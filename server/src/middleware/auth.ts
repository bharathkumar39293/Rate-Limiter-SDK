import { RequestHandler } from 'express';
import { pool } from '../db/pool';
import { hashKey } from '../services/keys';

declare global {
  namespace Express {
    interface Request {
      auth?: { apiKeyId: number; appId: number; tenantName: string };
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
      'SELECT k.id, k.app_id, k.tenant_name FROM api_keys k JOIN apps a ON a.id=k.app_id LEFT JOIN users u ON u.id=a.user_id WHERE k.key_hash = $1 AND k.revoked_at IS NULL AND (u.expires_at IS NULL OR u.expires_at > NOW())',
      [hashKey(key)]
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'A valid API key is required' });
      return;
    }
    req.auth = { apiKeyId: result.rows[0].id, appId: result.rows[0].app_id, tenantName: result.rows[0].tenant_name };
    next();
  } catch {
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
};
