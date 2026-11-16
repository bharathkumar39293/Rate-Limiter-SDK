const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { RateLimiterClient } = require('../dist');
for (const status of [200, 429, 400, 401, 500, 503]) {
  test(`HTTP ${status} SDK contract`, async () => {
    const body = { allowed: status === 200, remaining: 0, retryAfter: status === 429 ? 10 : null };
    const server = http.createServer((req, res) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const client = new RateLimiterClient({ apiKey: 'test', serverUrl: `http://127.0.0.1:${server.address().port}` });
      if (status === 400 || status === 401) await assert.rejects(client.check({ userId: 'u' }), /Rate Limiter error/);
      else assert.deepEqual(await client.check({ userId: 'u' }), status >= 500 ? { allowed: true, remaining: -1, retryAfter: null } : body);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}
