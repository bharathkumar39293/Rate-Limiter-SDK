import 'dotenv/config';
import { app } from './app';
import { initDb } from './services/logger';
initDb().then(() => app.listen(process.env.PORT || 3000, () => console.log('API ready'))).catch(() => {
  console.error('Database initialization failed; check schema and connection configuration');
  process.exit(1);
});
