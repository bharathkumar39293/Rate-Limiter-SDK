import { createClient } from 'redis';

// 1. Setup the connection to Redis
// We use the URL from our docker-compose.yml (updated port to 16380)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:16380';
const redis = createClient({ url: REDIS_URL });

redis.on('error', (err) => console.error('Redis Client Error', err));

let isConnected = false;

async function connectRedis() {
  if (!isConnected) {
    await redis.connect();
    isConnected = true;
  }
}

/**
 * The Heart of the Rate Limiter: Sliding Window Algorithm
 * 
 * @param apiKey - Identifies which developer is calling us
 * @param userId - Identifies which end-user is making the request
 * @param limit - Max allowed requests (e.g., 10)
 * @param windowSecs - Time frame (e.g., 60 seconds)
 */
export async function checkRateLimit(
  apiKey: string,
  userId: string,
  limit: number,
  windowSecs: number
): Promise<{ allowed: boolean; count: number; retryAfter?: number }> {
  await connectRedis();

  // Create a unique key for this specific user (e.g., "ratelimit:key123:user456")
  const key = `ratelimit:${apiKey}:${userId}`;
  const now = Date.now();
  const windowMs = windowSecs * 1000;

  // --- THE ALGORITHM ---

  // STEP A: "Clean the Notebook"
  // Remove all logs that are older than our window (now - windowMs).
  // This is what makes it a "Sliding" window—it always looks back from 'now'.
  await redis.zRemRangeByScore(key, 0, now - windowMs);

  // STEP B: "Count the Hits"
  // After cleaning, any entry left in the 'key' happened within the last 60s.
  const count = await redis.zCard(key);

  // STEP C: "The Verdict"
  if (count >= limit) {
    // User is over the limit! 
    // Let's find the oldest entry to tell them exactly how long to wait.
    const oldest = await redis.zRange(key, 0, 0);
    const oldestScore = oldest.length ? await redis.zScore(key, oldest[0]) : now;

    const retryAfter = Math.ceil(
      (Number(oldestScore) + windowMs - now) / 1000
    );

    return { allowed: false, count, retryAfter };
  }

  // STEP D: "Record the Hit"
  // If they are under the limit, we add their current visit timestamp.
  // We use a unique ID (timestamp + random) so entries don't overwrite each other.
  const requestId = `${now}-${Math.random()}`;
  await redis.zAdd(key, { score: now, value: requestId });

  // STEP E: "Auto-Cleanup"
  // Tell Redis to delete this entire notebook if no one uses it for a while.
  await redis.expire(key, windowSecs + 10);

  return { allowed: true, count: count + 1 };
}
