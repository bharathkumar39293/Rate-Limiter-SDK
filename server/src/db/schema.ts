import { pool } from './pool';

// Run explicitly before issuing keys. Legacy secrets must be migrated separately;
// do not silently drop existing tables or rewrite historical tenant ownership.
export async function initializeAuthSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        tenant_name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      );
    `);
    const columns = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'api_keys'
    `);
    const names = new Set(columns.rows.map(row => row.column_name));
    if (names.has('key') || !['tenant_name', 'key_prefix', 'key_hash', 'revoked_at'].every(name => names.has(name))) {
      throw new Error('Legacy api_keys schema detected. Explicit migration is required before issuing hashed keys.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
