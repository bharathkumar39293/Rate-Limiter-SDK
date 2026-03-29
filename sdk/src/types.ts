/**
 * Types of responses the SDK will give back to the developer's app.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number | null;
}

/**
 * Settings needed to initialize the SDK.
 */
export interface RateLimitConfig {
  apiKey: string;
  serverUrl: string; // The URL where our Express server is running
}
