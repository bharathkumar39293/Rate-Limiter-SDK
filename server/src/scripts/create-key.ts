import 'dotenv/config';
import { initializeAuthSchema } from '../db/schema';
import { pool } from '../db/pool';
import { createKey } from '../services/keys';

async function main() {
  const name = process.argv.slice(2).join(' ').trim();
  if (!name || name.length > 128) throw new Error('Usage: npm run create-key -- "Tenant Name" (1–128 characters)');
  await initializeAuthSchema();
  console.log(await createKey(name));
}

main().catch((error) => {
  // Do not print query parameters or connection strings.
  console.error(error instanceof Error ? error.message : 'Key creation failed');
  process.exitCode = 1;
}).finally(() => pool.end());
