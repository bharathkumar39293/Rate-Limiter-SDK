# Authenticated API setup

From `server/`, run `npm run create-key -- "Demo App"` with `DATABASE_URL` configured. Copy the printed key into the dashboard password field, or set `API_KEY` in the demo process environment. The dashboard keeps the key in memory; it does not embed it in a public Vite build.

Both `/api/check` and `/api/stats` require an issued, active key. `/health` remains public. Authentication queries PostgreSQL for every request and returns 503 on storage failure. Positive Redis authentication caching is not implemented. Database revocation takes effect on subsequent authentication checks; already authenticated requests may finish.

The API initializes its schema before listening. Legacy plaintext `api_keys` tables are rejected and require an explicit migration/key rotation. The request-log upgrade adds a nullable foreign key and removes the old `api_key` column, permanently removing historical raw secrets. Existing log rows remain unassigned and are excluded from tenant analytics. Back up data and review this migration before deploying to an existing database.

New logs store internal key IDs only. All statistics queries filter by that ID and return an explicit safe list of fields. Isolation is per issued key; multiple keys for the same tenant name do not share analytics or counters.

Validation accepts trimmed user IDs of 1–128 characters, integer limits 1–10000, and integer windows 1–86400 seconds. Invalid fields return 400 with an `errors` object. The JSON body size limit is 16 KiB.

Run `npm run build` followed by `npm test` from `server/` against dedicated PostgreSQL and Redis services. The API integration test creates its own keys and deletes its SQL rows on teardown. Redis test counters expire naturally. CI now supplies both services. The new API integration assertions have not yet been verified against live services.

## Verified integration update — 16 November 2026

The PostgreSQL 15 + Redis 7 CI run passed: six SDK tests and both server integration tests. Route authentication, per-key counters and statistics, revocation checks, input validation, and credential-aware dashboard/demo setup are now implemented. See the root README for current setup and verified coverage; earlier audit sections describe the pre-fix implementation.
