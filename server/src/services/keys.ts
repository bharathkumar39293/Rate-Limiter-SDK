import { createHash, randomBytes } from 'crypto';
import { pool } from '../db/pool';

export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export async function createKey(tenantName: string, appId?: number): Promise<string> {
  const name = tenantName.trim();
  if (!name || name.length > 128) throw new Error('Tenant name must contain 1–128 characters');
  const rawKey = `rl_live_${randomBytes(16).toString('hex')}`;
  if (!appId) appId = (await pool.query('INSERT INTO apps(name) VALUES($1) RETURNING id', [name])).rows[0].id;
  await pool.query(
    'INSERT INTO api_keys (tenant_name, key_prefix, key_hash, app_id) VALUES ($1, $2, $3, $4)',
    [name, rawKey.slice(0, 12), hashKey(rawKey), appId]
  );
  return rawKey;
}

export async function revokeKey(id: number): Promise<boolean> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid key ID');
  const result = await pool.query(
    'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id', [id]
  );
  return result.rows.length === 1;
}
