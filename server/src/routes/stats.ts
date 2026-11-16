import { Router } from 'express';
import { pool } from '../db/pool';
import { requireApiKey } from '../middleware/auth';
const router = Router();
router.get('/stats', requireApiKey, async (req, res) => {
  try {
    const params = [req.auth!.appId];
    const totals = await pool.query('SELECT COUNT(*) AS total_requests, COUNT(*) FILTER (WHERE NOT allowed) AS blocked_requests FROM request_logs WHERE app_id = $1', params);
    const recent = await pool.query('SELECT id,user_id,allowed,limit_used,timestamp FROM request_logs WHERE app_id = $1 ORDER BY timestamp DESC, id DESC LIMIT 50', params);
    const users = await pool.query('SELECT user_id,COUNT(*) AS hit_count,COUNT(*) FILTER (WHERE NOT allowed) AS blocked_count FROM request_logs WHERE app_id = $1 GROUP BY user_id ORDER BY hit_count DESC LIMIT 10', params);
    res.json({ totals: totals.rows[0], recent: recent.rows, topUsers: users.rows });
  } catch { res.status(503).json({ error: 'Statistics unavailable' }); }
});
export default router;
