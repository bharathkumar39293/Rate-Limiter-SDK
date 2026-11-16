// Run against a dedicated Redis instance: node --test test/concurrency.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
test('50 concurrent checks accept exactly 10 requests', async () => {
  const child = spawn(process.execPath, ['-e', `
    const { checkRateLimit, closeRedis } = require('./dist/services/redis');
    (async () => {
      const key = 'integration-' + require('node:crypto').randomUUID();
      try {
        const results = await Promise.all(Array.from({length:50}, () => checkRateLimit(key, 'u', 10, 60)));
        console.log(JSON.stringify(results));
      } finally {
        await closeRedis();
      }
    })().catch(error => { console.error(error); process.exit(1); });
  `], { cwd: require('node:path').resolve(__dirname, '..'), timeout: 15000 });
  let output = ''; let errors = '';
  child.stdout.on('data', data => output += data);
  child.stderr.on('data', data => errors += data);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  assert.equal(code, 0, errors);
  const results = JSON.parse(output.trim());
  assert.equal(results.filter(r => r.allowed).length, 10);
  assert.equal(results.filter(r => !r.allowed).length, 40);
  assert.ok(results.filter(r => !r.allowed).every(r => r.retryAfter > 0));
});
