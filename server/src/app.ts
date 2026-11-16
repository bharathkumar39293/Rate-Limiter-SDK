import express from 'express';
import limitRouter from './routes/limit';
import statsRouter from './routes/stats';
export const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use('/api', limitRouter, statsRouter);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
