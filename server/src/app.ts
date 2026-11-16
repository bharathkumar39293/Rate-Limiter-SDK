import portalRouter from './routes/portal';
import express from 'express';
import limitRouter from './routes/limit';
import statsRouter from './routes/stats';
export const app = express();
app.use((req, res, next) => {
  const origin = process.env.PORTAL_ORIGIN || 'http://localhost:5173';
  if (req.headers.origin === origin) { res.header('Access-Control-Allow-Origin', origin); res.header('Access-Control-Allow-Credentials', 'true'); res.vary('Origin'); }
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use(portalRouter);
app.use('/api', limitRouter, statsRouter);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
