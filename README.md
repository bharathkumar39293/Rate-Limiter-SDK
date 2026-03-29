# rate-limiter-sdk

A production-grade rate limiting SDK with Redis-backed sliding window algorithm.
Drop it into any Node.js app and get distributed rate limiting in 5 minutes.

## Why Sliding Window?
Unlike fixed-window algorithms, sliding window prevents burst traffic at
bucket boundaries — making it production-safe for high-traffic APIs.

## Quick Start
```bash
npm install rate-limiter-sdk
```

```typescript
import { RateLimiterClient } from 'rate-limiter-sdk'

const limiter = new RateLimiterClient({
  apiKey: 'your-api-key',
  serverUrl: 'http://localhost:3000'
})

const result = await limiter.check({ userId: 'user_123', limit: 100, window: 60 })

if (!result.allowed) {
  return res.status(429).json({ retryAfter: result.retryAfter })
}
```

## Architecture
SDK → API Server → Redis (algorithm) → PostgreSQL (logs) → Dashboard

## Tech Stack
TypeScript · Node.js · Express · Redis · PostgreSQL · React · Docker

## Key Engineering Decisions
- **Sliding window over fixed window**: prevents burst at boundaries.
- **Fail open on network errors**: SDK availability > strict limiting. If Redis goes down, we allow traffic to prevent blocking honest users.
- **Fail fast on network latency**: Timeout set to 2000ms.
- **Centralised Redis**: works across multiple server instances effortlessly.
- **Asynchronous PostgreSQL logging**: analytics recorded without slowing down the hot path of the rate limit API.

## Live Demo
Check the recorded video inside the artifacts!

## Local Setup
```bash
docker-compose up -d
cd server && npm install && npm run dev
cd dashboard && npm install && npm run dev
cd demo && npm install && node index.js
```
