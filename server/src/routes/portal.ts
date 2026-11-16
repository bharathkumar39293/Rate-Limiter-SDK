import { Router, RequestHandler } from 'express';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { pool } from '../db/pool';
import { createKey, hashKey } from '../services/keys';
const derive = promisify(scrypt);
const router = Router();
const origin = process.env.PORTAL_ORIGIN || 'http://localhost:5173';
const wrap = (fn: RequestHandler): RequestHandler => (req,res,next) => { Promise.resolve(fn(req,res,next)).catch(() => res.status(503).json({error:'Portal unavailable'})); };
declare global { namespace Express { interface Request { user?: { id:number; demo:boolean }; appId?:number } } }
router.use((req,res,next) => {
 if((req.path.startsWith('/auth/') || req.path === '/apps' || req.path.startsWith('/apps/')) && req.method !== 'GET' && req.headers.origin !== origin) { res.status(403).json({error:'Invalid request origin'}); return; }
 next();
});
const session:RequestHandler=wrap(async(req,res,next)=>{
 const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('rl_session='))?.slice(11);
 if(!token || !/^[a-f0-9]{64}$/.test(token)){res.sendStatus(401);return;}
 const r=await pool.query('SELECT u.id,u.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND (u.expires_at IS NULL OR u.expires_at>NOW())',[hashKey(token)]);
 if(!r.rows.length){res.sendStatus(401);return;}
 req.user={id:r.rows[0].id,demo:!!r.rows[0].expires_at};next();
});
async function issueSession(res:any,id:number){
 const token=randomBytes(32).toString('hex');
 await pool.query("INSERT INTO sessions VALUES($1,$2,NOW()+INTERVAL '1 hour')",[hashKey(token),id]);
 res.cookie('rl_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:3600000,path:'/'});
}
router.post('/auth/:action',wrap(async(req,res)=>{
 const action=req.params.action;
 if(action==='logout'){
 const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('rl_session='))?.slice(11);
 if(token)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[hashKey(token)]);
 res.clearCookie('rl_session',{path:'/'});res.sendStatus(204);return;
 }
 if(action==='demo'){
 // Demo creation is opt-in until deployment-level abuse controls are configured.
 if(process.env.ENABLE_DEMO!=='true'){res.status(403).json({error:'Demo disabled'});return;}
 const r=await pool.query("INSERT INTO users(expires_at) VALUES(NOW()+INTERVAL '1 hour') RETURNING id");
 await pool.query("INSERT INTO apps(user_id,name) VALUES($1,'Demo App')",[r.rows[0].id]);
 await issueSession(res,r.rows[0].id);res.status(201).json({demo:true});return;
 }
 if(!['register','login'].includes(action)){res.sendStatus(404);return;}
 const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
 const password=req.body?.password;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>128){res.status(400).json({error:'Valid email and password of 12–128 characters required'});return;}
 if(action==='register'){
 const salt=randomBytes(16).toString('hex');
 const hash=(await derive(password,salt,64)) as Buffer;
 const r=await pool.query('INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id',[email,`${salt}:${hash.toString('hex')}`]);
 if(!r.rows.length){res.status(409).json({error:'Account cannot be created'});return;}
 await issueSession(res,r.rows[0].id);res.status(201).json({ok:true});return;
 }
 const r=await pool.query('SELECT id,password_hash FROM users WHERE email=$1 AND expires_at IS NULL',[email]);
 const [salt,stored]=(r.rows[0]?.password_hash || '00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');
 const computed=await derive(password,salt,64) as Buffer;
 if(!timingSafeEqual(computed,Buffer.from(stored,'hex'))||!r.rows.length){res.sendStatus(401);return;}
 await issueSession(res,r.rows[0].id);res.json({ok:true});
}));
router.use('/apps',session);
router.get('/apps',wrap(async(req,res)=>{res.json((await pool.query('SELECT id,name,created_at FROM apps WHERE user_id=$1',[req.user!.id])).rows);}));
router.post('/apps',wrap(async(req,res)=>{
 const name=req.body?.name;
 if(typeof name!=='string'||!name.trim()||name.length>128){res.status(400).json({error:'Name must contain 1–128 characters'});return;}
 const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user!.id]);
 const n=await c.query('SELECT COUNT(*) FROM apps WHERE user_id=$1',[req.user!.id]);
 if(Number(n.rows[0].count)>=(req.user!.demo?2:20)){await c.query('ROLLBACK');res.status(409).json({error:'Application limit reached'});return;}
 const a=await c.query('INSERT INTO apps(user_id,name) VALUES($1,$2) RETURNING id,name',[req.user!.id,name.trim()]);await c.query('COMMIT');res.status(201).json(a.rows[0]);
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
router.use('/apps/:id',wrap(async(req,res,next)=>{
 if(!/^[1-9]\d{0,9}$/.test(req.params.id)){res.sendStatus(404);return;}
 const r=await pool.query('SELECT id FROM apps WHERE id=$1 AND user_id=$2',[req.params.id,req.user!.id]);
 if(!r.rows.length){res.sendStatus(404);return;}req.appId=r.rows[0].id;next();
}));
router.get('/apps/:id/keys',wrap(async(req,res)=>{res.json((await pool.query('SELECT id,key_prefix,created_at,revoked_at FROM api_keys WHERE app_id=$1',[req.appId])).rows);}));
router.post('/apps/:id/keys',wrap(async(req,res)=>{
 // Lock the app across count and insertion to enforce caps under concurrency.
 const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM apps WHERE id=$1 FOR UPDATE',[req.appId]);
 const n=await c.query('SELECT COUNT(*) FROM api_keys WHERE app_id=$1',[req.appId]);
 if(Number(n.rows[0].count)>=5){await c.query('ROLLBACK');res.status(409).json({error:'Key limit reached'});return;}
 const key=`rl_live_${randomBytes(16).toString('hex')}`;
 await c.query('INSERT INTO api_keys(tenant_name,key_prefix,key_hash,app_id) VALUES($1,$2,$3,$4)',['Portal App',key.slice(0,12),hashKey(key),req.appId]);await c.query('COMMIT');res.status(201).json({key});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
router.delete('/apps/:id/keys/:keyId',wrap(async(req,res)=>{
 if(!/^[1-9]\d{0,9}$/.test(req.params.keyId)){res.sendStatus(404);return;}
 const r=await pool.query('UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND app_id=$2 RETURNING id',[req.params.keyId,req.appId]);res.sendStatus(r.rows.length?204:404);
}));
router.get('/apps/:id/stats',wrap(async(req,res)=>{
 const p=[req.appId];
 const totals=await pool.query('SELECT COUNT(*) AS total_requests, COUNT(*) FILTER(WHERE NOT allowed) AS blocked_requests FROM request_logs WHERE app_id=$1',p);
 const recent=await pool.query('SELECT id,user_id,allowed,limit_used,timestamp FROM request_logs WHERE app_id=$1 ORDER BY timestamp DESC LIMIT 50',p);
 res.json({totals:totals.rows[0],recent:recent.rows});
}));
export default router;

