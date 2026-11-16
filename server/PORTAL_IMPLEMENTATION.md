# Portal backend implementation

Implemented account registration/login/logout with asynchronous scrypt passwords and one-hour, hashed session tokens in HttpOnly, SameSite=Strict cookies (Secure in production). Set PORTAL_ORIGIN to the exact browser origin, including port; default http://localhost:5173. Cookie-authenticated writes require that Origin. For localhost development use consistent hostnames for browser and API.

Routes: POST /auth/register, /auth/login, /auth/logout, /auth/demo; GET/POST /apps; GET/POST /apps/:id/keys; DELETE /apps/:id/keys/:keyId; GET /apps/:id/stats. Key creation returns the secret once. Lists expose only metadata. Missing app ownership returns 404.

Demo creation requires ENABLE_DEMO=true. Each demo receives a distinct account and initial app, with a one-hour account/session lifetime, at most two apps, and at most five total issued keys per app. Normal accounts are limited to twenty apps and five total keys per app. Expired demo credentials are rejected. Physical cleanup of expired accounts is not yet scheduled. Deployment-level throttling for registration/login/demo creation is required before exposing this portal publicly.

Application IDs now own Redis counters and log scopes. Key rotation preserves counters and analytics. Legacy keys receive distinct unowned applications; no existing key is automatically claimed by a new user. Counter namespaces change on upgrade, so old active windows are not migrated. The older legacy log-column removal caveat in AUTH_IMPLEMENTATION.md still applies.

Locally verified against Redis and PostgreSQL: existing API checks and concurrent burst, plus registration, cross-account ownership rejection, key rotation preserving active limits, historical app statistics, demo isolation, and application/key caps. These additions are inside the API integration test. The server TypeScript build passes. No new CI run has been triggered.

Pending product work: portal frontend, one-time key modal and snippet, traffic simulator, login abuse controls, demo data cleanup, and versioned migrations. The running local application has not been restarted to use this new backend.
