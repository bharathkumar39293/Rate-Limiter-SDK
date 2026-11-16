const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../dist/app');
const { initDb } = require('../dist/services/logger');
const { pool } = require('../dist/db/pool');
const { createKey, hashKey, revokeKey } = require('../dist/services/keys');
const { closeRedis } = require('../dist/services/redis');
test('authenticated API validates inputs and isolates tenants', { timeout: 30000 }, async () => {
  let server; const ids = [];
  try {
    await initDb();
    const keys = await Promise.all([createKey('integration A'), createKey('integration B')]);
    for (const key of keys) ids.push((await pool.query('SELECT id FROM api_keys WHERE key_hash=$1',[hashKey(key)])).rows[0].id);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (path,key,body) => fetch(base+path,{method: body ? 'POST':'GET', headers:{'Content-Type':'application/json',...(key ? {'x-api-key':key}: {})}, ...(body ? {body:JSON.stringify(body)}:{})});
    for (const path of ['/api/check','/api/stats']) {
      for (const key of [undefined, 'bad', 'rl_live_'+'0'.repeat(32)]) assert.equal((await call(path,key,path.endsWith('check') ? {userId:'u'}:undefined)).status,401);
    }
    for (const body of [{limit:0},{limit:10001},{limit:1.5},{window:0},{window:86401},{window:'60'},{userId:'x'.repeat(129)},{userId:'   '}]) {
      const response = await call('/api/check',keys[0],{userId:'same',...body});
      assert.equal(response.status,400); assert.ok((await response.json()).errors);
    }
    for (const [key,status] of [[keys[0],200],[keys[0],429],[keys[1],200]]) assert.equal((await call('/api/check',key,{userId:'same',limit:1,window:60})).status,status);
    // Logging is asynchronous; wait for persisted rows before inspecting totals.
    for (let i=0;i<100;i++) {
      const count = await pool.query('SELECT COUNT(*) FROM request_logs WHERE api_key_id=ANY($1::int[])',[ids]);
      if (Number(count.rows[0].count)===3) break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    for (const [i,total] of [[0,2],[1,1]]) {
      const response=await call('/api/stats',keys[i]); assert.equal(response.status,200);
      const data=await response.json(); assert.equal(Number(data.totals.total_requests),total);
      assert.equal(data.recent.length,total);
      assert.equal(Number(data.topUsers[0].hit_count),total);
      for (const row of data.recent) assert.deepEqual(Object.keys(row).sort(),['allowed','id','limit_used','timestamp','user_id']);
    }
    await revokeKey(ids[0]);
    for (const path of ['/api/check','/api/stats']) assert.equal((await call(path,keys[0],path.endsWith('check')?{userId:'same'}:undefined)).status,401);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await closeRedis();
    if(ids.length) {
      await pool.query('DELETE FROM request_logs WHERE api_key_id=ANY($1::int[])',[ids]);
      await pool.query('DELETE FROM api_keys WHERE id=ANY($1::int[])',[ids]);
    }
    await pool.end();
  }
});
