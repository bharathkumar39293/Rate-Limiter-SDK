# Rate Limiter SDK

[![CI](https://github.com/bharathkumar39293/Rate-Limiter-SDK/actions/workflows/ci.yml/badge.svg)](https://github.com/bharathkumar39293/Rate-Limiter-SDK/actions/workflows/ci.yml)

A TypeScript rate limiting SDK and Express service with atomic Redis sliding-window enforcement, hashed API keys, and per-key analytics.

```text
Application -> SDK -> authenticated Express API -> Redis (atomic Lua decision)
                                              -> PostgreSQL (async logs)
Dashboard -> authenticated statistics API -> PostgreSQL
```

Redis Lua uses Redis server time to prune, count, and conditionally record accepted requests in one atomic operation. Counters and statistics are isolated by internal API key ID. Each issued key is an independent scope, even when tenant names match.

## Verified CI coverage

[Security milestone CI run](https://github.com/bharathkumar39293/Rate-Limiter-SDK/actions/runs/43849343824) passed against Redis 7 and PostgreSQL 15:

- Six SDK regressions: HTTP 200/429 results, 400/401 errors, and 500/503 fail-open behavior.
- A 50-request concurrent Redis burst: exactly 10 allowed and 40 denied.
- API integration: missing, malformed, unknown, and revoked keys rejected on both routes; isolated counters and analytics; safe recent-log response fields; invalid input bounds returning field-level 400 errors.

These tests verify these specific scenarios; they are not throughput or availability guarantees.

## Local setup

Start databases from the repository root:

```sh
docker compose up -d
```

Build the SDK:

```sh
cd sdk
npm ci
npm run build
```

From `server/`, install dependencies and issue a key:

```sh
npm ci
npm run create-key -- "Demo App"
npm run dev
```

Copy the generated key; it is printed once. Only its SHA-256 hash and identifying prefix are stored in the new key table. The local defaults use Redis port 16380 and PostgreSQL port 15433. Override with `REDIS_URL`, `DATABASE_URL`, and `PORT` in the server environment or `.env`.

From `dashboard/`, run `npm ci` and `npm run dev`. Enter the issued key in the dashboard password field. It is held in browser memory. `VITE_API_URL` configures the API address; the default is `http://localhost:3000`.

From `demo/`, run `npm ci`, set `API_KEY` in your process environment, and run `node index.js`. For PowerShell:

```powershell
$env:API_KEY = 'your-issued-key'
node index.js
```

## SDK usage

```typescript
import { RateLimiterClient } from 'rate-limiter-sdk';

const limiter = new RateLimiterClient({
  apiKey: process.env.API_KEY!,
  serverUrl: 'http://localhost:3000',
});
const result = await limiter.check({ userId: 'user_123', limit: 100, window: 60 });
if (!result.allowed) {
  // Stop the protected action and return 429 to your caller.
  console.log('Retry in seconds:', result.retryAfter);
}
```

The SDK is built locally in this repository; npm publication availability is not asserted here.

## API and validation

- `POST /api/check`: requires `x-api-key`; accepts trimmed `userId` of 1–128 characters, integer `limit` of 1–10000 (default 100), and integer `window` of 1–86400 seconds (default 60). Denials return 429; invalid fields return 400.
- `GET /api/stats`: requires `x-api-key`; returns only that key's totals, recent logs, and top users, without key material.
- `GET /health`: public process health response, not a dependency-readiness probe.

Authentication checks PostgreSQL on each request; revoked keys are rejected by subsequent authentication checks. There is no positive auth cache. Requests authenticated before revocation may finish. Authentication storage errors return 503. The SDK fails open on 5xx and network failures, with a two-second HTTP timeout; callers needing strict outage enforcement must account for this policy.

Analytics writes are asynchronous and can be lost on database failure. There is no durable log queue or retention policy.

## Existing database migration

Review [authentication and migration notes](server/AUTH_IMPLEMENTATION.md) before deployment. Legacy plaintext `api_keys` tables require explicit migration and rotation. API startup removes the legacy raw-key log column; existing historical rows remain unassigned and are excluded from tenant statistics. Back up and review existing data before running this upgrade.

## Tests

Build before testing in each package:

```sh
npm run build
npm test
```

SDK tests use local HTTP fixtures. Server tests require dedicated Redis and PostgreSQL services configured through `REDIS_URL` and `DATABASE_URL`. CI provides both with health checks. Tests await schema initialization and close HTTP, Redis, and PostgreSQL resources.
