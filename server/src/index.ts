import express from 'express';
// dotenv loads our secrets from a .env file (if we have one)
import dotenv from 'dotenv';
// We bring in the "Phone Line" we just built
import limitRouter from './routes/limit';
import statsRouter from './routes/stats';
import { initDb } from './services/logger';

dotenv.config();

// Think of this as opening the doors to our server building
const app = express();
// We will listen on port 3000 (unless Railway tells us to use a different one)
const port = process.env.PORT || 3000;

// Add CORS so our React Dashboard (running on a different port) can talk to us
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
  next();
});

// This tells our server: "If someone sends you a JSON message, please translate it so I can read it."
app.use(express.json());

// Initialize Database
initDb();

// --- Mount our Routes ---
// We plug the "Phone Line" into the switchboard. 
// Now, if anyone calls '/api/check', they are routed to limitRouter.
app.use('/api', limitRouter);

// We plug the "Dashboard Line" into the switchboard.
app.use('/api', statsRouter);

// A simple heartbeat route to check if our server is alive
app.get('/health', (req, res) => {
  res.json({ status: 'Server is alive! 💓' });
});

// Finally, we turn on the lights and start listening for calls
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
