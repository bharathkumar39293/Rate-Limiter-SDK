import { Router, Request, Response } from 'express';
import { checkRateLimit } from '../services/redis';
import { logRequest } from '../services/logger';

const router = Router();

/**
 * POST /api/check
 * 
 * This is the exact phone number our "Guard" (SDK) will call to ask the "Manager" (Server).
 * It listens for incoming HTTP POST requests.
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    // 1. Who is asking? What are their rules?
    // We expect the SDK to send these three things in the 'body' of the request:
    const { userId, limit = 100, window = 60 } = req.body;

    // 2. Who is the "Guard" (Developer) calling?
    // We expect them to prove who they are with a secret badge (API Key) in the "headers".
    const apiKey = req.headers['x-api-key'] as string;

    // --- Safety Checks ---
    if (!apiKey) {
      // 401 Unauthorized: The developer forgot their badge!
      return res.status(401).json({ error: 'API key is required in x-api-key header' });
    }
    if (!userId) {
      // 400 Bad Request: We don't know which user wants to come into the club!
      return res.status(400).json({ error: 'userId is required in the request body' });
    }

    // --- The Big Question ---
    // The Manager looks at the notebook (Redis)...
    const result = await checkRateLimit(apiKey, userId, limit, window);

    // --- The Records (Logging) ---
    // We tell an intern to stick a copy of this in the filing cabinet (PostgreSQL).
    // Notice we DO NOT use 'await' here. We don't want the user waiting in line
    // while the intern walks to the filing cabinet! This makes our API way faster.
    logRequest(apiKey, userId, result.allowed, result.count).catch(console.error);

    // --- The Answer ---
    // If Redis said allowed: true, we send a 200 OK status.
    // If Redis said allowed: false, we send a 429 Too Many Requests status.
    return res.status(result.allowed ? 200 : 429).json({
      allowed: result.allowed,
      // Calculate how many they have left (if they went over, we just say 0 instead of a negative number)
      remaining: Math.max(0, limit - result.count),
      // If they were blocked, we tell them *exactly* how many seconds to wait
      retryAfter: result.retryAfter ?? null,
    });

  } catch (error) {
    console.error('CRITICAL ERROR: Manager is sick or notebook is on fire!', error);
    
    // --- FAIL-OPEN STRATEGY ---
    // If our code crashes or Redis dies, we DO NOT want to crash the developer's app!
    // We take the blame and just let the user in anyway. 
    // This is incredibly important for production-grade software!
    return res.status(200).json({
      allowed: true,
      remaining: -1, // We don't know how many are left, so we return a dummy value
      retryAfter: null,
      warning: 'Internal server error - failing open to protect your application'
    });
  }
});

export default router;
