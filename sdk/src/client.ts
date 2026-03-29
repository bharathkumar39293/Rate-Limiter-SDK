import axios, { AxiosError } from 'axios';
import { RateLimitConfig, RateLimitResult } from './types';

export class RateLimiterClient {
  private apiKey: string;
  private serverUrl: string;

  /**
   * Developers use this to setup the SDK in their own app.
   * e.g., const limiter = new RateLimiterClient({ apiKey: '123', serverUrl: '...' });
   */
  constructor(config: RateLimitConfig) {
    this.apiKey = config.apiKey;
    this.serverUrl = config.serverUrl;
  }

  /**
   * The single method the developer needs to call to check a limit.
   */
  async check(options: {
    userId: string;
    limit?: number;
    window?: number;
  }): Promise<RateLimitResult> {
    try {
      // We use axios to make the HTTP POST request to our "Manager" (Express Server).
      // Notice how we send the API key securely in the headers, not the body.
      const response = await axios.post<RateLimitResult>(
        `${this.serverUrl}/api/check`,
        options,
        {
          headers: { 'x-api-key': this.apiKey },
          // --- FAIL-FAST STRATEGY ---
          // If our server takes more than 2 seconds to answer, we hang up!
          // We don't want to freeze the developer's app while we figure our stuff out.
          timeout: 2000,
        }
      );

      // If the server answered quickly and normally, we return the result.
      return response.data;

    } catch (error) {
      // A lot of things can go wrong: Our server could be down, the internet could drop, 
      // or the timeout could trigger.
      
      const axiosError = error as AxiosError;

      // If there IS a response, but it's an error code (like 401 Unauthorized or 400 Bad Request),
      // we need to tell the developer they messed up.
      if (axiosError.response) {
         // We cast it to any because our server returns custom eror messages { error: "..." } for bad requests
         throw new Error(`Rate Limiter error: ${JSON.stringify(axiosError.response.data)}`);
      }

      // --- FAIL-OPEN STRATEGY (Part 2) ---
      // If there is NO response (e.g., server offline, network timeout),
      // we warn the developer's console, but we ALLOW the request anyway!
      // This is the absolute core of "high availability" SDK design.
      console.warn('[RateLimiterSDK] Server unreachable or timed out — failing open. Allowing request.');
      return {
        allowed: true,
        remaining: -1,
         retryAfter: null
      };
    }
  }
}
