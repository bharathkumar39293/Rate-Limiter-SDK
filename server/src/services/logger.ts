import { pool } from '../db/pool';
import { initializeAuthSchema } from '../db/schema';
export async function initDb() {
  await initializeAuthSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id SERIAL PRIMARY KEY, api_key_id INTEGER REFERENCES api_keys(id),
      user_id TEXT NOT NULL, allowed BOOLEAN NOT NULL, limit_used INTEGER,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS api_key_id INTEGER REFERENCES api_keys(id);
    ALTER TABLE request_logs DROP COLUMN IF EXISTS api_key;
    CREATE INDEX IF NOT EXISTS idx_logs_tenant_time ON request_logs(api_key_id, timestamp);
  `);
}
export async function logRequest(apiKeyId: number, userId: string, allowed: boolean, count: number) {
  await pool.query('INSERT INTO request_logs (api_key_id,user_id,allowed,limit_used) VALUES ($1,$2,$3,$4)', [apiKeyId,userId,allowed,count]);
}
