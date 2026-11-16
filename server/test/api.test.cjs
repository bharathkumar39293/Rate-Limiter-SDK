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

    const origin = process.env.PORTAL_ORIGIN || 'http://localhost:5173';
    const portal = async (path, cookie, body, method) => fetch(base+path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
      ...(body ? {body:JSON.stringify(body)} : {})
    });
    const accounts=[];
    try {
      for(let i=0;i<2;i++) {
        const email=require('node:crypto').randomUUID()+'@example.com';
        const r=await portal('/auth/register',null,{email,password:'test-password-long-123'});
        assert.equal(r.status,201);
        accounts.push({email,cookie:r.headers.get('set-cookie').split(';')[0]});
      }
      const a=await (await portal('/apps',accounts[0].cookie,{name:'Rotation App'})).json();
      for(const path of ['keys','stats']) assert.equal((await portal('/apps/'+a.id+'/'+path,accounts[1].cookie)).status,404);
      const first=await (await portal('/apps/'+a.id+'/keys',accounts[0].cookie,{})).json();
      assert.equal((await call('/api/check',first.key,{userId:'rotation',limit:1,window:60})).status,200);
      let before;
      for(let i=0;i<100;i++) {
        before=await (await portal('/apps/'+a.id+'/stats',accounts[0].cookie)).json();
        if(Number(before.totals.total_requests)===1)break;
        await new Promise(r=>setTimeout(r,20));
      }
      assert.equal(Number(before.totals.total_requests),1);
      const listing=await (await portal('/apps/'+a.id+'/keys',accounts[0].cookie)).json();
      assert.equal((await portal('/apps/'+a.id+'/keys/'+listing[0].id,accounts[0].cookie,null,'DELETE')).status,204);
      const second=await (await portal('/apps/'+a.id+'/keys',accounts[0].cookie,{})).json();
      assert.equal((await call('/api/check',second.key,{userId:'rotation',limit:1,window:60})).status,429);
      process.env.ENABLE_DEMO='true';
      const d=await portal('/auth/demo',null,{}); assert.equal(d.status,201);
      const cookie=d.headers.get('set-cookie').split(';')[0];
      assert.equal((await portal('/apps/'+a.id+'/stats',cookie)).status,404);
      assert.equal((await portal('/apps',cookie,{name:'Second'})).status,201);
      assert.equal((await portal('/apps',cookie,{name:'Third'})).status,409);
      const apps=await (await portal('/apps',cookie)).json();
      for(let i=0;i<5;i++) assert.equal((await portal('/apps/'+apps[0].id+'/keys',cookie,{})).status,201);
      assert.equal((await portal('/apps/'+apps[0].id+'/keys',cookie,{})).status,409);
      // Include demo account in cleanup.
      const demo=await pool.query('SELECT user_id FROM apps WHERE id=$1',[apps[0].id]);
      accounts.push({id:demo.rows[0].user_id});
    } finally {
      for(const account of accounts) {
        const user=account.id || (await pool.query('SELECT id FROM users WHERE email=$1',[account.email])).rows[0]?.id;
        if(!user)continue;
        await pool.query('DELETE FROM request_logs WHERE app_id IN (SELECT id FROM apps WHERE user_id=$1)',[user]);
        await pool.query('DELETE FROM api_keys WHERE app_id IN (SELECT id FROM apps WHERE user_id=$1)',[user]);
        await pool.query('DELETE FROM apps WHERE user_id=$1',[user]);
        await pool.query('DELETE FROM sessions WHERE user_id=$1',[user]);
        await pool.query('DELETE FROM users WHERE id=$1',[user]);
      }
    }
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
