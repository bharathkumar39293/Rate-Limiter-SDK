import { Pool } from 'pg';

// 1. Setup the connection to PostgreSQL
// We use the URL from our docker-compose.yml (updated port to 15433)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://admin:password@localhost:15433/ratelimiter';

// We use a "Pool". Imagine PostgreSQL as a bank teller. 
// A Pool means we have 10 tellers ready to work, instead of waiting in 1 long line.
const pool = new Pool({
  connectionString: DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client (PostgreSQL)', err);
});

/**
 * The "Filing Cabinet" Logger
 * We use this to save records of every request so the Boss can look at them later on the Dashboard.
 */
export async function logRequest(
  apiKey: string,
  userId: string,
  allowed: boolean,
  limitUsed: number
): Promise<void> {
  try {
    const query = `
      INSERT INTO request_logs (api_key, user_id, allowed, limit_used)
      VALUES ($1, $2, $3, $4)
    `;
    const values = [apiKey, userId, allowed, limitUsed];

    // We open a drawer, put the file inside, and close the drawer.
    await pool.query(query, values);
  } catch (error) {
    // --- SILENT FAILURE ---
    // If our database is broken, we DO NOT crash the server.
    // Logging is a "nice to have" feature. Rate limiting is the "must have" feature.
    // It's better to lose a dashboard log than to block a real user from the app.
    console.error('Failed to write to PostgreSQL log (but request was still processed)', error);
  }
}

/**
 * A helper function to create the tables if they don't exist yet.
 */
export async function initDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS request_logs (
      id SERIAL PRIMARY KEY,
      api_key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      allowed BOOLEAN NOT NULL,
      limit_used INTEGER,
      timestamp TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_logs_api_key ON request_logs(api_key);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON request_logs(timestamp);
  `;
  try {
    await pool.query(schema);
    console.log('PostgreSQL Tables are ready!');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL', err);
  }
}
