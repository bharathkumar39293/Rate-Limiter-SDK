const { RateLimiterClient } = require('../sdk');

// 1. We initialize the SDK you just built!
const limiter = new RateLimiterClient({
  apiKey: 'demo_developer_key_123',
  serverUrl: 'http://localhost:3000'
});

// We create a list of fake users
const users = [
  'user_alice', // Honest user
  'user_bob',   // Honest user
  'user_mallory', // Abusive user (spamming)
  'user_mallory', // Abusive user
  'user_mallory', // Abusive user
];

console.log('--- STARTING RATE LIMITER DEMO ---');
console.log('The "Guard" (SDK) is now checking visitors...\\n');

let requestCount = 0;

setInterval(async () => {
  const randomUser = users[Math.floor(Math.random() * users.length)];
  requestCount++;
  
  try {
    const result = await limiter.check({ 
      userId: randomUser, 
      limit: 5, 
      window: 10 
    });

    if (result.allowed) {
      console.log(`✅ [Req ${requestCount}] ${randomUser} was ALLOWED. (${result.remaining} remaining)`);
    } else {
      console.log(`❌ [Req ${requestCount}] ${randomUser} was BLOCKED! Try again in ${result.retryAfter}s`);
    }

  } catch (error) {
    if (error.message.includes('failing open')) {
         console.log(`⚠️  [Req ${requestCount}] Server down! FAIL-OPEN triggered. User ${randomUser} allowed anyway.`);
    } else {
         console.error('Unexpected error:', error.message);
    }
  }
}, 300);
