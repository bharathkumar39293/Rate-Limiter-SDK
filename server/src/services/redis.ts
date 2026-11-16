import { randomUUID } from 'crypto';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:16380' });
redis.on('error', (err) => console.error('Redis Client Error', err));
let connection: Promise<unknown> | undefined;

async function connectRedis() {
  if (!connection) {
    connection = redis.connect().catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  await connection;
}

// Redis executes the entire decision without interleaving other requests.
// Use Redis time so multiple API instances share the same clock.
const slidingWindowScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
  return {0, count, retry}
end
redis.call('ZADD', key, now, ARGV[3])
redis.call('PEXPIRE', key, window + 10000)
return {1, count + 1, 0}
`;

export async function closeRedis(): Promise<void> {
  if (redis.isOpen) await redis.quit();
  connection = undefined;
}

export async function checkRateLimit(
  apiKey: string,
  userId: string,
  limit: number,
  windowSecs: number
): Promise<{ allowed: boolean; count: number; retryAfter?: number }> {
  if (!Number.isSafeInteger(limit) || limit <= 0 ||
      !Number.isSafeInteger(windowSecs) || windowSecs <= 0 ||
      windowSecs > Math.floor(Number.MAX_SAFE_INTEGER / 1000) - 10) {
    throw new Error('limit and window must be positive safe integers within supported bounds');
  }
  await connectRedis();
  const result = await redis.eval(slidingWindowScript, {
    keys: [`ratelimit:${apiKey}:${userId}`],
    arguments: [String(limit), String(windowSecs * 1000), randomUUID()],
  }) as number[];
  return result[0] === 1
    ? { allowed: true, count: result[1] }
    : { allowed: false, count: result[1], retryAfter: result[2] };
}
