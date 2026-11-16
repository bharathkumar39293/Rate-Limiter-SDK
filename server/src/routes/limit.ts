import { Router } from 'express';
import { requireApiKey } from '../middleware/auth';
import { checkRateLimit } from '../services/redis';
import { logRequest } from '../services/logger';
const router = Router();
router.post('/check', requireApiKey, async (req, res) => {
  const body = req.body;
  const errors: Record<string,string> = {};
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const limit = body?.limit === undefined ? 100 : body.limit;
  const window = body?.window === undefined ? 60 : body.window;
  if (!userId || userId.length > 128) errors.userId = 'Must contain 1?128 non-whitespace characters';
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) errors.limit = 'Must be an integer between 1 and 10000';
  if (!Number.isInteger(window) || window < 1 || window > 86400) errors.window = 'Must be an integer between 1 and 86400 seconds';
  if (Object.keys(errors).length) { res.status(400).json({ errors }); return; }
  try {
    const id = req.auth!.apiKeyId;
    const result = await checkRateLimit(String(id), userId, limit, window);
    void logRequest(id, userId, result.allowed, result.count).catch(() => console.error('Request logging failed'));
    res.status(result.allowed ? 200 : 429).json({ allowed: result.allowed, remaining: Math.max(0, limit-result.count), retryAfter: result.retryAfter ?? null });
  } catch {
    res.json({ allowed: true, remaining: -1, retryAfter: null, warning: 'Rate limiting unavailable; failing open' });
  }
});
export default router;
