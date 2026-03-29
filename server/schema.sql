-- The 'users' of our SDK (Developers who sign up to use our service)
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Every single time someone asks our Guard "Can I come in?", we write a log here.
-- This gets massive very fast!
CREATE TABLE IF NOT EXISTS request_logs (
  id SERIAL PRIMARY KEY,
  api_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  limit_used INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes make looking up data much faster later when we build the dashboard.
CREATE INDEX IF NOT EXISTS idx_logs_api_key ON request_logs(api_key);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON request_logs(timestamp);
