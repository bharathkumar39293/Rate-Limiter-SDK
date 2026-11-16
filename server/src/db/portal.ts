import { pool } from './pool';
export async function initializePortal() {
 await pool.query(`
 CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS apps(id SERIAL PRIMARY KEY,user_id INTEGER REFERENCES users(id),name TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires_at TIMESTAMPTZ NOT NULL);
 ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS app_id INTEGER REFERENCES apps(id);
 ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS app_id INTEGER REFERENCES apps(id);
 CREATE INDEX IF NOT EXISTS idx_logs_app_time ON request_logs(app_id,timestamp);
 `);
 // Preserve existing credentials/history, assigning each legacy key its own app.
 const c=await pool.connect();
 try { await c.query('BEGIN');
 const keys=await c.query('SELECT id,tenant_name FROM api_keys WHERE app_id IS NULL FOR UPDATE');
 for(const key of keys.rows) {
 const a=await c.query('INSERT INTO apps(name) VALUES($1) RETURNING id',[key.tenant_name]);
 await c.query('UPDATE api_keys SET app_id=$1 WHERE id=$2',[a.rows[0].id,key.id]);
 }
 await c.query('UPDATE request_logs l SET app_id=k.app_id FROM api_keys k WHERE l.api_key_id=k.id AND l.app_id IS NULL');
 await c.query('COMMIT');
 } catch(e){await c.query('ROLLBACK');throw e;} finally{c.release();}
}
