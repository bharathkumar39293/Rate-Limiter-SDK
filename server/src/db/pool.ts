import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@localhost:15433/ratelimiter',
  connectionTimeoutMillis: 2000,
});
pool.on('error', (error) => console.error('PostgreSQL connection error', error));
