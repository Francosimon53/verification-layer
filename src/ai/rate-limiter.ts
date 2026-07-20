/**
 * Rate Limiter - Prevent exceeding API rate limits
 */

import { AI_CONFIG } from './config.js';

export class RateLimiter {
  private callTimestamps: number[] = [];
  private totalCalls = 0;

  canMakeCall(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove timestamps older than 1 minute
    this.callTimestamps = this.callTimestamps.filter((t) => t > oneMinuteAgo);

    // Check per-minute limit
    if (
      this.callTimestamps.length >= AI_CONFIG.rateLimit.maxCallsPerMinute
    ) {
      return false;
    }

    // Check per-scan limit
    if (this.totalCalls >= AI_CONFIG.rateLimit.maxCallsPerScan) {
      return false;
    }

    return true;
  }

  recordCall(): void {
    this.callTimestamps.push(Date.now());
    this.totalCalls++;
  }

  async waitIfNeeded(): Promise<void> {
    if (this.canMakeCall()) {
      return;
    }

    // Wait for the oldest call to expire
    const oldestCall = this.callTimestamps[0];
    if (oldestCall) {
      const waitTime = 60000 - (Date.now() - oldestCall) + 100; // +100ms buffer
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  reset(): void {
    this.callTimestamps = [];
    this.totalCalls = 0;
  }

  getStats(): { callsThisMinute: number; totalCalls: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const callsThisMinute = this.callTimestamps.filter((t) => t > oneMinuteAgo).length;
    return { callsThisMinute, totalCalls: this.totalCalls };
  }
}
