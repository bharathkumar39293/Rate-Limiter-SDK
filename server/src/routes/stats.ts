import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

// Connect to the same PostgreSQL database
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://admin:password@localhost:15433/ratelimiter';
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * GET /api/stats
 * 
 * This route is purely for our React Dashboard. Not for the SDK.
 * It reads the "Filing Cabinet" (PostgreSQL) and sends the data to the UI.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // 1. Get total requests and blocked requests
    const totalsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN allowed = false THEN 1 ELSE 0 END) as blocked_requests
      FROM request_logs
    `);

    // 2. Get recent traffic (last 50 requests) to show a live feed
    const recentLogsResult = await pool.query(`
      SELECT * FROM request_logs 
      ORDER BY timestamp DESC 
      LIMIT 50
    `);

    // 3. Group by user to see who is the most active
    const byUserResult = await pool.query(`
      SELECT user_id, COUNT(*) as hit_count, SUM(CASE WHEN allowed = false THEN 1 ELSE 0 END) as blocked_count
      FROM request_logs
      GROUP BY user_id
      ORDER BY hit_count DESC
      LIMIT 10
    `);

    res.json({
      totals: totalsResult.rows[0],
      recent: recentLogsResult.rows,
      topUsers: byUserResult.rows
    });
  } catch (error) {
    console.error('Failed to fetch stats', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
